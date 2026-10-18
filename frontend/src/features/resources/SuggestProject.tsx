import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAction, useMe } from '../../lib/hooks';
import { Avatar, BusyLabel, Dialog, ErrorNotice } from '../../components/ui';
import './suggest-project.css';

type Suggestion = {
  source: 'gemini' | 'fallback' | 'not-configured';
  retrieval?: 'embeddings' | 'keyword';
  reason?: string;
  retrieval_reason?: string;
  interests: string[];
  project: {
    title: string;
    description: string;
    difficulty: string;
    steps: string[];
    parts: {
      id: number;
      title: string;
      category: string;
      status: string;
      owner: { id: number; display_name: string; role: string };
    }[];
  };
};

const reasonText: Record<string, string> = {
  'invalid-key': 'The Gemini key was rejected. Check GEMINI_API_KEY in backend/.env.',
  'key-or-api-disabled':
    'The Generative Language API is not enabled for this key, or the key is restricted. Check the key in Google AI Studio.',
  'model-not-found': 'The model name was not recognized. Check GEMINI_MODEL and GEMINI_EMBED_MODEL.',
  quota: 'The Gemini quota is used up for now. Check the limits in AI Studio.',
  network: 'The server could not reach Google. Check its internet connection.',
};

function reasonMessage(result: Suggestion): string {
  if (result.reason && reasonText[result.reason]) return reasonText[result.reason];
  if (result.reason) return `Gemini returned an error (${result.reason}). Check the Django console for details.`;
  return 'The AI service could not be reached, so this is a simple match from the catalog.';
}

function SuggestDialog({ onClose }: { onClose: () => void }) {
  const [availableOnly, setAvailableOnly] = useState(true);
  const [goal, setGoal] = useState('');
  const [result, setResult] = useState<Suggestion | null>(null);
  const [postedId, setPostedId] = useState<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!result) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [result]);
  const navigate = useNavigate();
  const { data: meData } = useMe();
  const action = useAction<Suggestion>();
  const post = useAction<{ id: number }>();
  const postIdea = () => {
    if (!result) return;
    const { project } = result;
    const lines = [
      project.description,
      '',
      'Parts:',
      ...project.parts.map(
        (part) => `- ${part.title}${part.status === 'available' ? '' : ' (not available - may need to buy)'}`,
      ),
      '',
      'Steps:',
      ...project.steps.map((step, index) => `${index + 1}. ${step}`),
    ];
    post.mutate(
      {
        path: '/projects/',
        method: 'POST',
        body: {
          title: project.title.slice(0, 140),
          description: lines.join('\n').slice(0, 4000),
          is_hardware: true,
          tags: [],
          needed_skills: [],
        },
      },
      { onSuccess: (created) => setPostedId(created.id) },
    );
  };
  const suggest = () =>
    action.mutate(
      {
        path: '/suggest-project/',
        method: 'POST',
        body: { available_only: availableOnly, prompt: goal },
      },
      { onSuccess: setResult },
    );
  return (
    <Dialog title="Suggest a project" onClose={onClose}>
      <p>Get a project idea based on your interests and the parts library.</p>
      <label htmlFor="suggest-goal">What do you want to build? (optional)</label>
      <textarea
        id="suggest-goal"
        rows={2}
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        placeholder="e.g. something that monitors air quality in my dorm"
      />
      <label className="suggest-toggle">
        <input
          type="checkbox"
          checked={availableOnly}
          onChange={(event) => setAvailableOnly(event.target.checked)}
        />
        Only parts available right now
      </label>
      <div className="button-row">
        <button className="button full" onClick={suggest} disabled={action.isPending}>
          <BusyLabel busy={action.isPending}>Suggest</BusyLabel>
        </button>
      </div>
      {action.isError && <ErrorNotice error={action.error} retry={suggest} />}
      {result && (
        <div className="suggest-result" ref={resultRef}>
          <h3>{result.project.title}</h3>
          {result.project.difficulty && (
            <span className="suggest-difficulty">{result.project.difficulty}</span>
          )}
          <p>{result.project.description}</p>
          {result.project.parts.length > 0 && (
            <ul className="suggest-parts">
              {result.project.parts.map((part) => (
                <li key={part.id}>
                  {/* New tabs so the dialog and its suggestion stay put. */}
                  <a href={`/resources/${part.id}`} target="_blank" rel="noopener noreferrer">
                    {part.title}
                  </a>
                  {part.status !== 'available' && (
                    <span
                      className="suggest-unavailable"
                      role="img"
                      aria-label={`${part.title} is not available right now, you may have to buy it`}
                      title="Not available right now - you may have to buy it"
                    >
                      !
                    </span>
                  )}
                  <span className="suggest-owner">
                    <Avatar name={part.owner.display_name} />
                    <a
                      href={part.owner.id === meData?.user?.id ? '/profile' : `/members/${part.owner.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {part.owner.display_name}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {result.project.steps.length > 0 && (
            <ol>
              {result.project.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}
          {result.source === 'not-configured' && (
            <p className="suggest-note">
              AI suggestions are not configured yet, so this is a simple match from the catalog.
            </p>
          )}
          {result.source === 'fallback' && <p className="suggest-note">{reasonMessage(result)}</p>}
          {result.source === 'gemini' && result.retrieval === 'keyword' && (
            <p className="suggest-note">
              Embeddings were unavailable, so parts were matched by keywords instead.
            </p>
          )}
          <div className="suggest-post">
            {!postedId && (
              <button className="button secondary full" onClick={postIdea} disabled={post.isPending}>
                <BusyLabel busy={post.isPending}>Post as a project idea</BusyLabel>
              </button>
            )}
            {post.isError && <ErrorNotice error={post.error} retry={postIdea} />}
            {postedId && (
              <button
                className="button full"
                onClick={() => {
                  onClose();
                  navigate(`/projects/${postedId}`);
                }}
              >
                Idea posted - view it
              </button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function SuggestProject() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button secondary suggest-button" onClick={() => setOpen(true)}>
        <Sparkles size={16} />
        Suggest a project
      </button>
      {open && <SuggestDialog onClose={() => setOpen(false)} />}
    </>
  );
}
