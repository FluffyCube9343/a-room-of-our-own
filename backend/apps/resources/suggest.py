"""RAG project suggester: retrieve relevant parts with Gemini embeddings, then
ask Gemini to suggest a build from just those parts.

The Gemini key comes from the GEMINI_API_KEY environment variable only and is
never logged or returned. The model and embedding calls each live in one small
function so they can be swapped (e.g. to Bedrock) without touching the rest.
Without a key, or if a call fails, the view falls back to keyword matching so
the feature still demos.
"""
import hashlib
import json
import logging
import math
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

from rest_framework.response import Response
from rest_framework.views import APIView

from apps.community.serializers import author
from .recommendations import interest_matches
from .views import resources_for

TIMEOUT = 20
MAX_PARTS = 60       # hard cap on listings considered for retrieval
TOP_K = 12           # retrieved listings passed to the generation call

PROMPT = """You are helping a student hardware community suggest a build project.

Member interests: {interests}
What the member wants to build: {goal}

Relevant parts from the library ({scope}):
{parts}

Suggest ONE realistic project the member could build with these parts.
Reply with JSON only, no markdown, in exactly this shape:
{{"title": str, "description": str, "difficulty": "beginner"|"intermediate"|"advanced",
  "steps": [str, ...], "part_ids": [int, ...]}}
Rules: part_ids may only contain ids from the parts above; use 3 to 8 parts that
genuinely fit the project; prefer available parts and only include a NOT AVAILABLE
one when it is clearly worth buying; 4 to 7 short steps; keep the description under 60 words."""


def model_name(env_var, default):
    """Model id from the environment; tolerate the 'models/' prefix that
    models.list output and the Google docs show, so 'models/gemini-2.5-flash'
    and 'gemini-2.5-flash' both work."""
    return os.getenv(env_var, default).strip().removeprefix('models/')


def embed_model():
    return model_name('GEMINI_EMBED_MODEL', 'gemini-embedding-001')


def call_gemini_api(model, method, body, timeout=TIMEOUT):
    """One POST to the Gemini API; the key travels in the header, never the URL."""
    key = os.getenv('GEMINI_API_KEY')
    request = Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{model}:{method}',
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': key},
    )
    with urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed Google host
        return json.loads(response.read())


def embed_texts(texts, task_type):
    """Batch-embed texts with the Gemini embedding model."""
    model = embed_model()
    payload = call_gemini_api(model, 'batchEmbedContents', {'requests': [
        {'model': f'models/{model}', 'content': {'parts': [{'text': text}]}, 'taskType': task_type}
        for text in texts]})
    return [entry['values'] for entry in payload['embeddings']]


def classify_error(exc):
    """Short non-secret reason code; details (never the key) go to the Django console."""
    if isinstance(exc, HTTPError):
        try:
            message = json.loads(exc.read()).get('error', {}).get('message', '')
        except Exception:
            message = ''
        # The URL holds no secret (the key travels in the header); log its path
        # so a 404 shows exactly which model and method Google rejected.
        logger.warning('Gemini API HTTP %s for %s: %s', exc.code, getattr(exc, 'url', '?'), message[:300])
        if exc.code == 400 and 'API key' in message:
            return 'invalid-key'
        if exc.code == 400:
            return 'bad-request'
        if exc.code == 403:
            return 'key-or-api-disabled'
        if exc.code == 404:
            return 'model-not-found'
        if exc.code == 429:
            return 'quota'
        return f'http-{exc.code}'
    if isinstance(exc, (URLError, TimeoutError, OSError)):
        logger.warning('Gemini API unreachable: %s', getattr(exc, 'reason', exc))
        return 'network'
    logger.exception('Gemini call failed unexpectedly')
    return 'error'


def gemini_suggest(interests, goal, parts, scope):
    """One generation call; swap this to Bedrock later without touching retrieval."""
    model = model_name('GEMINI_MODEL', 'gemini-3.8-flash')
    prompt = PROMPT.format(
        interests=', '.join(interests) if interests else 'not specified',
        goal=goal or 'open to anything',
        scope=scope,
        parts='\n'.join(f"- id={p['id']} | {p['title']} ({p['category']}){'' if p['status'] == 'available' else ' [NOT AVAILABLE - member may have to buy it]'}: {p['description'][:160]}" for p in parts),
    )
    payload = call_gemini_api(model, 'generateContent', {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.7},
    })
    text = payload['candidates'][0]['content']['parts'][0]['text']
    match = re.search(r'\{.*\}', text, re.S)
    data = json.loads(match.group(0))
    if not isinstance(data.get('part_ids'), list) or not data.get('title'):
        raise ValueError('Unexpected Gemini response shape')
    return data


def listing_text(resource):
    return f'{resource.title}. {resource.category}. {resource.description} {resource.condition}'


def signature(resource):
    return hashlib.sha1(listing_text(resource).encode()).hexdigest()


# Process-local embedding cache: listing id -> (content signature, vector).
# Re-embeds only new or edited listings; each Gunicorn worker holds its own copy.
_embedding_cache = {}


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def retrieve(resources, query_text, k=TOP_K):
    """Top-k listings by embedding similarity to the query. Raises on API failure."""
    ids = {resource.id for resource in resources}
    for stale in [cached for cached in _embedding_cache if cached not in ids]:
        del _embedding_cache[stale]
    fresh = [r for r in resources if _embedding_cache.get(r.id, (None,))[0] != signature(r)]
    if fresh:
        vectors = embed_texts([listing_text(r) for r in fresh], 'RETRIEVAL_DOCUMENT')
        for resource, vector in zip(fresh, vectors):
            _embedding_cache[resource.id] = (signature(resource), vector)
    query_vector = embed_texts([query_text], 'RETRIEVAL_QUERY')[0]
    ranked = sorted(resources, key=lambda r: -cosine(query_vector, _embedding_cache[r.id][1]))
    return ranked[:k]


def keyword_rank(interests_tags, resources):
    scored = [(len(interest_matches(r, interests_tags)), r) for r in resources]
    scored.sort(key=lambda pair: (-pair[0], pair[1].title))
    return [r for _, r in scored]


def fallback_suggest(interests_tags, resources):
    """Simple keyword match so the feature works with no Gemini key."""
    chosen = [r for r in keyword_rank(interests_tags, resources)
              if interest_matches(r, interests_tags)][:5] or resources[:3]
    titles = ', '.join(r.title for r in chosen[:3])
    return {
        'title': 'Parts library starter build',
        'description': f'A starter project matched to your interests from what is on the shelf, built around the {titles}.',
        'difficulty': 'beginner',
        'steps': [
            'Pick up the parts listed below from their owners.',
            'Sketch what you want the build to do in one sentence.',
            'Assemble the core circuit or structure first.',
            'Test each part on its own before combining them.',
            'Show it in a room and borrow anything else you need.',
        ],
        'part_ids': [r.id for r in chosen],
    }


class SuggestProject(APIView):
    def post(self, request):
        available_only = bool(request.data.get('available_only', True))
        goal = str(request.data.get('prompt', ''))[:500].strip()
        qs = resources_for(request.user).order_by('title')
        scope = 'only parts available right now' if available_only else 'all listed parts'
        if available_only:
            qs = qs.filter(status='available')
        resources = list(qs[:MAX_PARTS])
        interests_tags = list(request.user.profile.interests.all())
        interests = [tag.label for tag in interests_tags]
        source, retrieval = 'gemini', 'embeddings'
        reason = retrieval_reason = None
        try:
            if not os.getenv('GEMINI_API_KEY'):
                source = 'not-configured'
                data = fallback_suggest(interests_tags, resources)
            else:
                query_text = f"Interests: {', '.join(interests)}. Wants to build: {goal or 'any hardware project'}"
                try:
                    chosen = retrieve(resources, query_text)
                except Exception as exc:
                    retrieval = 'keyword'
                    retrieval_reason = classify_error(exc)
                    chosen = keyword_rank(interests_tags, resources)[:TOP_K]
                parts = [{'id': r.id, 'title': r.title, 'category': r.category,
                          'description': r.description, 'status': r.status}
                         for r in chosen]
                try:
                    data = gemini_suggest(interests, goal, parts, scope)
                except Exception as exc:
                    reason = classify_error(exc)
                    raise
        except Exception:
            source, retrieval = 'fallback', 'keyword'
            data = fallback_suggest(interests_tags, resources)
        by_id = {r.id: r for r in resources}
        chosen = [by_id[i] for i in data.get('part_ids', []) if isinstance(i, int) and i in by_id]
        if not chosen:
            chosen = resources[:3]
        return Response({
            'source': source,
            'retrieval': retrieval,
            **({'reason': reason} if reason else {}),
            **({'retrieval_reason': retrieval_reason} if retrieval_reason else {}),
            'project': {
                'title': str(data.get('title', 'Project idea'))[:140],
                'description': str(data.get('description', ''))[:600],
                'difficulty': str(data.get('difficulty', ''))[:20],
                'steps': [str(step)[:200] for step in data.get('steps', [])[:8]],
                'parts': [{'id': r.id, 'title': r.title, 'category': r.category,
                           'status': r.status, 'owner': author(r.owner)} for r in chosen],
            },
            'interests': interests,
        })
