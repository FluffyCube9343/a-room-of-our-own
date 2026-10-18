import io
import json
import os
from unittest import mock
from urllib.error import HTTPError

from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.community.models import Tag
from apps.resources.models import Resource
from apps.projects.models import Project
from apps.resources import suggest


def fake_response(payload):
    fake = mock.Mock()
    fake.read.return_value = json.dumps(payload).encode()
    fake.__enter__ = lambda self: self
    fake.__exit__ = mock.Mock(return_value=False)
    return fake


GEMINI_JSON = {'title': 'Line-following robot', 'description': 'A small bot that follows tape.',
               'difficulty': 'intermediate', 'steps': ['Wire it.', 'Flash it.'], 'part_ids': []}


class SuggestProjectTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('suggest@example.com', 'strong-password')
        cls.user.profile.onboarding_complete = True
        cls.user.profile.save()
        cls.tag = Tag.objects.create(label='Robotics', slug='robotics')
        cls.user.profile.interests.add(cls.tag)
        cls.available = Resource.objects.create(
            owner=cls.user, title='Arduino Uno R3', description='Microcontroller board for robotics builds.',
            category='electronics', condition='Works', location='Rice Hall', status='available')
        cls.paused = Resource.objects.create(
            owner=cls.user, title='Paused motor driver', description='Motor driver board, not out on loan.',
            category='tools', condition='Works', location='Rice Hall', status='paused')

    def setUp(self):
        suggest._embedding_cache.clear()
        self.client = APIClient()
        self.client.force_login(self.user)

    def listing_vectors(self):
        texts = {suggest.listing_text(self.available): [1.0, 0.0],
                 suggest.listing_text(self.paused): [0.0, 1.0]}
        return texts

    def test_requires_login(self):
        self.client.logout()
        response = self.client.post('/api/v1/suggest-project/', {}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_fallback_without_key_uses_available_only(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('GEMINI_API_KEY', None)
            response = self.client.post('/api/v1/suggest-project/', {'available_only': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'not-configured')
        ids = [part['id'] for part in response.data['project']['parts']]
        self.assertIn(self.available.id, ids)
        self.assertNotIn(self.paused.id, ids)
        self.assertEqual(response.data['interests'], ['Robotics'])

    def test_fallback_can_include_all_parts(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('GEMINI_API_KEY', None)
            response = self.client.post('/api/v1/suggest-project/', {'available_only': False}, format='json')
        self.assertEqual(response.status_code, 200)
        ids = [part['id'] for part in response.data['project']['parts']]
        self.assertIn(self.paused.id, ids)
        paused_part = next(part for part in response.data['project']['parts'] if part['id'] == self.paused.id)
        self.assertEqual(paused_part['status'], 'paused')
        self.assertEqual(paused_part['owner']['display_name'], self.user.profile.display_name)

    def test_rag_embeds_and_generates(self):
        vectors = self.listing_vectors()

        def route(request, timeout=None):
            body = json.loads(request.data)
            if 'batchEmbedContents' in request.full_url:
                out = []
                for r in body['requests']:
                    text = r['content']['parts'][0]['text']
                    if r['taskType'] == 'RETRIEVAL_QUERY':
                        self.assertIn('robot arm', text)  # free-text goal reaches the query embedding
                        out.append({'values': [1.0, 0.0]})
                    else:
                        out.append({'values': vectors[text]})
                return fake_response({'embeddings': out})
            prompt = body['contents'][0]['parts'][0]['text']
            self.assertIn('Arduino Uno R3', prompt)
            self.assertIn('robot arm', prompt)  # goal reaches the generation prompt too
            suggestion = {**GEMINI_JSON, 'part_ids': [self.available.id, 99999]}
            return fake_response({'candidates': [{'content': {'parts': [{'text': json.dumps(suggestion)}]}}]})

        with mock.patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                mock.patch('apps.resources.suggest.urlopen', side_effect=route) as call:
            response = self.client.post('/api/v1/suggest-project/',
                                        {'available_only': True, 'prompt': 'robot arm'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'gemini')
        self.assertEqual(response.data['retrieval'], 'embeddings')
        self.assertEqual(response.data['project']['title'], 'Line-following robot')
        ids = [part['id'] for part in response.data['project']['parts']]
        self.assertEqual(ids, [self.available.id])  # unknown id 99999 dropped
        # Only the available listing was embedded (toggle excluded the paused one).
        embed_requests = [c for c in call.call_args_list if 'batchEmbedContents' in c[0][0].full_url]
        embedded = [r['content']['parts'][0]['text']
                    for c in embed_requests for r in json.loads(c[0][0].data)['requests']]
        self.assertNotIn(suggest.listing_text(self.paused), embedded)
        # Key travels in the header, never the URL.
        for c in call.call_args_list:
            self.assertEqual(c[0][0].headers.get('X-goog-api-key'), 'test-key')
            self.assertNotIn('test-key', c[0][0].full_url)

    def test_embedding_cache_skips_unchanged_listings(self):
        vectors = self.listing_vectors()

        def route(request, timeout=None):
            body = json.loads(request.data)
            if 'batchEmbedContents' in request.full_url:
                out = []
                for r in body['requests']:
                    text = r['content']['parts'][0]['text']
                    out.append({'values': [0.5, 0.5] if r['taskType'] == 'RETRIEVAL_QUERY' else vectors[text]})
                return fake_response({'embeddings': out})
            suggestion = {**GEMINI_JSON, 'part_ids': [self.available.id]}
            return fake_response({'candidates': [{'content': {'parts': [{'text': json.dumps(suggestion)}]}}]})

        with mock.patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                mock.patch('apps.resources.suggest.urlopen', side_effect=route) as call:
            self.client.post('/api/v1/suggest-project/', {'available_only': False}, format='json')
            self.client.post('/api/v1/suggest-project/', {'available_only': False}, format='json')
        doc_embeds = [r for c in call.call_args_list if 'batchEmbedContents' in c[0][0].full_url
                      for r in json.loads(c[0][0].data)['requests'] if r['taskType'] == 'RETRIEVAL_DOCUMENT']
        self.assertEqual(len(doc_embeds), 2)  # both listings embedded once, none re-embedded

    def test_embed_failure_uses_keyword_retrieval(self):
        def route(request, timeout=None):
            if 'batchEmbedContents' in request.full_url:
                raise OSError('embedding api down')
            suggestion = {**GEMINI_JSON, 'part_ids': [self.available.id]}
            return fake_response({'candidates': [{'content': {'parts': [{'text': json.dumps(suggestion)}]}}]})

        with mock.patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                mock.patch('apps.resources.suggest.urlopen', side_effect=route):
            response = self.client.post('/api/v1/suggest-project/', {'available_only': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'gemini')
        self.assertEqual(response.data['retrieval'], 'keyword')

    def http_error(self, code, message):
        body = json.dumps({'error': {'message': message}}).encode()
        return HTTPError('https://generativelanguage.googleapis.com/x', code, 'err', {}, io.BytesIO(body))

    def test_invalid_key_reason_reaches_ui(self):
        with mock.patch.dict(os.environ, {'GEMINI_API_KEY': 'bad-key'}), \
                mock.patch('apps.resources.suggest.urlopen',
                           side_effect=lambda request, timeout=None: (_ for _ in ()).throw(
                               self.http_error(400, 'API key not valid. Please pass a valid API key.'))):
            response = self.client.post('/api/v1/suggest-project/', {'available_only': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'fallback')
        self.assertEqual(response.data['reason'], 'invalid-key')

    def test_forbidden_reason_and_embed_fallback_reason(self):
        calls = {'n': 0}
        def route(request, timeout=None):
            calls['n'] += 1
            if 'batchEmbedContents' in request.full_url:
                raise self.http_error(404, 'models/gemini-embedding-001 is not found')
            raise self.http_error(403, 'Generative Language API has not been used in project 1 before or it is disabled')
        with mock.patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                mock.patch('apps.resources.suggest.urlopen', side_effect=route):
            response = self.client.post('/api/v1/suggest-project/', {'available_only': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'fallback')
        self.assertEqual(response.data['reason'], 'key-or-api-disabled')
        self.assertEqual(response.data['retrieval_reason'], 'model-not-found')

    def test_model_env_vars_tolerate_models_prefix(self):
        def route(request, timeout=None):
            self.assertNotIn('models/models/', request.full_url)
            if 'batchEmbedContents' in request.full_url:
                self.assertIn('models/gemini-embedding-001:batchEmbedContents', request.full_url)
                body = json.loads(request.data)
                return fake_response({'embeddings': [{'values': [0.5, 0.5]} for _ in body['requests']]})
            self.assertIn('models/gemini-3.8-flash:generateContent', request.full_url)
            suggestion = {**GEMINI_JSON, 'part_ids': [self.available.id]}
            return fake_response({'candidates': [{'content': {'parts': [{'text': json.dumps(suggestion)}]}}]})
        with mock.patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key',
                                          'GEMINI_MODEL': 'models/gemini-3.8-flash',
                                          'GEMINI_EMBED_MODEL': 'models/gemini-embedding-001'}), \
                mock.patch('apps.resources.suggest.urlopen', side_effect=route):
            response = self.client.post('/api/v1/suggest-project/', {'available_only': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'gemini')

    def test_post_idea_payload_creates_project(self):
        # The exact body shape the suggest dialog posts to /projects/.
        body = {'title': 'Air quality sentinel', 'description': 'Parts:\n- SCD30 CO2 sensor',
                'is_hardware': True, 'tags': [], 'needed_skills': []}
        response = self.client.post('/api/v1/projects/', body, format='json')
        self.assertEqual(response.status_code, 201)
        project = Project.objects.get(pk=response.data['id'])
        self.assertEqual(project.cover_credit, '')  # never null: the shared DB column is NOT NULL
        self.assertEqual(project.owner, self.user)

    def test_gemini_error_falls_back(self):
        with mock.patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                mock.patch('apps.resources.suggest.urlopen', side_effect=OSError('down')):
            response = self.client.post('/api/v1/suggest-project/', {'available_only': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'fallback')
