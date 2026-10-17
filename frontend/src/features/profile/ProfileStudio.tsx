import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAction, useApi, useMe } from '../../lib/hooks';
import {
  BusyLabel,
  ConfirmButton,
  ErrorNotice,
  Loading,
  PageHeader,
  Toast,
} from '../../components/ui';
import type { Profile, ProfilePhoto, Prompt, PromptOption } from '../../types';

export function ProfileStudio() {
  const query = useMe();
  if (!query.data?.user) return <Loading />;
  return <Studio key={query.data.user.id} profile={query.data.user.profile} />;
}
function Studio({ profile }: { profile: Profile }) {
  const bank = useApi<{ results: PromptOption[] }>('/profile/prompt-options/');
  const [prompts, setPrompts] = useState<Prompt[]>(profile.prompts);
  const [pick, setPick] = useState('');
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState<Error | null>(null);
  const action = useAction();
  const shown = prompts.filter((p) => p.visible).length;
  const update = (index: number, changes: Partial<Prompt>) =>
    setPrompts(prompts.map((p, i) => (i === index ? { ...p, ...changes } : p)));
  const move = (index: number, by: number) => {
    const next = [...prompts];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setPrompts(next);
  };
  return (
    <div className="studio-page">
      <Link className="back-link" to="/profile">
        <ArrowLeft size={16} />
        Your profile
      </Link>
      <PageHeader
        eyebrow="A PROFILE THAT FEELS LIKE YOU"
        title="A little personality goes a long way."
        description="Your photos. Your stories. Your kind of people."
        action={
          <Link className="button secondary" to="/profile">
            <Eye size={16} />
            View saved profile
          </Link>
        }
      />
      <div className="studio-layout">
        <div>
          <PhotoEditor photos={profile.photos} />
          <section className="panel prompt-editor">
            <div className="section-heading">
              <div>
                <span className="eyebrow">IN YOUR OWN WORDS</span>
                <h2>Choose your prompts.</h2>
              </div>
              <span className="count-pill">{shown} / 3 showing</span>
            </div>
            <p>
              Show up to three answers. Keep the others as private drafts, and change the order
              whenever you like.
            </p>
            {prompts.map((prompt, index) => (
              <div
                className={`editable-prompt ${prompt.visible ? '' : 'draft-prompt'}`}
                key={prompt.key}
              >
                <div className="editable-prompt-top">
                  <span>
                    {prompt.label || bank.data?.results.find((p) => p.key === prompt.key)?.label}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove prompt: ${prompt.label}`}
                    onClick={() => setPrompts(prompts.filter((p) => p.key !== prompt.key))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <textarea
                  aria-label={prompt.label || prompt.key}
                  rows={3}
                  maxLength={600}
                  placeholder="The more you, the better."
                  value={prompt.answer}
                  onChange={(event) => update(index, { answer: event.target.value })}
                />
                <div className="prompt-editor-controls">
                  <button
                    type="button"
                    className={`quiet-button ${prompt.visible ? 'selected' : ''}`}
                    aria-pressed={prompt.visible}
                    disabled={!prompt.visible && shown >= 3}
                    onClick={() => update(index, { visible: !prompt.visible })}
                  >
                    {prompt.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    {prompt.visible ? 'Showing on profile' : 'Private draft'}
                  </button>
                  <span className="reorder-buttons">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move prompt ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move prompt ${index + 1} down`}
                      disabled={index === prompts.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                  </span>
                </div>
              </div>
            ))}
            {bank.isPending ? (
              <Loading />
            ) : bank.isError ? (
              <ErrorNotice error={bank.error} retry={() => void bank.refetch()} />
            ) : (
              <div className="add-prompt">
                <label>
                  Find your next prompt
                  <select value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">Explore {bank.data.results.length} prompts…</option>
                    {bank.data.results
                      .filter((option) => !prompts.some((p) => p.key === option.key))
                      .map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="button secondary"
                  disabled={!pick}
                  onClick={() => {
                    const option = bank.data.results.find((p) => p.key === pick)!;
                    setPrompts([
                      ...prompts,
                      { ...option, answer: '', order: prompts.length, visible: shown < 3 },
                    ]);
                    setPick('');
                  }}
                >
                  <Plus size={16} />
                  Add prompt
                </button>
              </div>
            )}
            <ErrorNotice error={localError || action.error} />
            <Toast message={message} />
            <button
              className="button"
              disabled={action.isPending}
              onClick={async () => {
                setLocalError(null);
                setMessage('');
                if (prompts.some((p) => p.visible && !p.answer.trim())) {
                  setLocalError(
                    new Error(
                      'Add an answer to each showing prompt, or switch it to a private draft.',
                    ),
                  );
                  return;
                }
                try {
                  await action.mutateAsync({
                    path: '/profile/',
                    method: 'PATCH',
                    body: {
                      prompts: prompts
                        .filter((p) => p.answer.trim())
                        .map((p, order) => ({ ...p, answer: p.answer.trim(), order })),
                    },
                  });
                  setMessage('Your prompts are saved, in the order you chose.');
                } catch {
                  /* displayed */
                }
              }}
            >
              <BusyLabel busy={action.isPending}>Save my prompts</BusyLabel>
            </button>
          </section>
        </div>
        <aside>
          <ProfessionalLinksEditor profile={profile} />
          <section className="studio-note">
            <span>✳</span>
            <h3>Give someone a place to start.</h3>
            <p>
              A project you love. Your latest rabbit hole. The thing you could talk about for hours.
            </p>
            <p>People can like a specific photo or answer and send you a little note.</p>
            <Link className="text-link" to="/profile/edit">
              Edit your basics <ArrowUp size={14} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
function PhotoEditor({ photos }: { photos: ProfilePhoto[] }) {
  const action = useAction();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');
  const reorder = async (index: number, by: number) => {
    const ids = photos.map((p) => p.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    try {
      await action.mutateAsync({ path: '/profile/photos/order/', method: 'PUT', body: { ids } });
      setMessage('Photo order saved.');
    } catch {
      /*shown*/
    }
  };
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE MANY SIDES OF YOU</span>
          <h2>Your photo story.</h2>
        </div>
        <span className="count-pill">{photos.length} / 6</span>
      </div>
      <p>
        A face, a favorite project, a little life outside the laptop. The first photo leads your
        profile. Photos are optional.
      </p>
      <div className="photo-edit-grid">
        {photos.map((photo, index) => (
          <div className="photo-editor-card" key={photo.id}>
            <div className="photo-edit-image">
              <img src={photo.url} alt={photo.caption || `Your profile photo ${index + 1}`} />
              {index === 0 && <span className="photo-lead-label">Profile cover</span>}
            </div>
            <PhotoCaption key={`${photo.id}-${photo.caption}`} photo={photo} />
            <div className="photo-editor-actions">
              <button
                className="icon-button"
                aria-label={`Move photo ${index + 1} up`}
                disabled={index === 0 || action.isPending}
                onClick={() => void reorder(index, -1)}
              >
                <ArrowUp size={15} />
              </button>
              <button
                className="icon-button"
                aria-label={`Move photo ${index + 1} down`}
                disabled={index === photos.length - 1 || action.isPending}
                onClick={() => void reorder(index, 1)}
              >
                <ArrowDown size={15} />
              </button>
              <ConfirmButton
                className="icon-button"
                label={
                  <>
                    <Trash2 size={15} />
                    <span className="sr-only">Delete photo {index + 1}</span>
                  </>
                }
                title="Remove this photo?"
                busy={action.isPending}
                onConfirm={() =>
                  action.mutateAsync({ path: `/profile/photos/${photo.id}/`, method: 'DELETE' })
                }
              >
                This photo and its caption will be removed from your profile.
              </ConfirmButton>
            </div>
          </div>
        ))}
        {photos.length < 6 && (
          <button
            className="photo-upload-tile"
            disabled={action.isPending}
            onClick={() => input.current?.click()}
          >
            <Camera size={29} strokeWidth={1.3} />
            <span>Add a photo</span>
            <small>JPG, PNG, WebP · up to 5 MB</small>
          </button>
        )}
      </div>
      <input
        ref={input}
        className="sr-only"
        type="file"
        aria-label="Upload profile photo"
        accept="image/jpeg,image/png,image/webp"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setError(null);
          setMessage('');
          if (file.size > 5 * 1024 * 1024) {
            setError(new Error('Choose a photo under 5 MB.'));
            event.target.value = '';
            return;
          }
          const body = new FormData();
          body.append('image', file);
          try {
            await action.mutateAsync({ path: '/profile/photos/', body });
            setMessage('Photo added. Give it a caption below.');
          } catch {
            /*shown*/
          } finally {
            if (input.current) input.current.value = '';
          }
        }}
      />
      {action.isPending && (
        <p className="meta">
          <Upload size={14} />
          Saving your photo story…
        </p>
      )}
      <ErrorNotice error={error || action.error} />
      <Toast message={message} />
    </section>
  );
}
function PhotoCaption({ photo }: { photo: ProfilePhoto }) {
  const [caption, setCaption] = useState(photo.caption);
  const action = useAction();
  return (
    <form
      className="caption-form"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await action.mutateAsync({
            path: `/profile/photos/${photo.id}/`,
            method: 'PATCH',
            body: { caption },
          });
        } catch {
          /*shown*/
        }
      }}
    >
      <label>
        Caption
        <textarea
          rows={2}
          maxLength={240}
          value={caption}
          placeholder="A little context goes a long way…"
          onChange={(e) => setCaption(e.target.value)}
        />
      </label>
      <button className="text-link" disabled={action.isPending || caption === photo.caption}>
        Save caption
      </button>
      <ErrorNotice error={action.error} />
    </form>
  );
}
function ProfessionalLinksEditor({ profile }: { profile: Profile }) {
  const action = useAction();
  const [message, setMessage] = useState('');
  return (
    <section className="panel">
      <span className="eyebrow">A LITTLE MORE OF YOUR WORK</span>
      <h2>Your links.</h2>
      <p>All optional. These appear to members who can view your profile.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          try {
            await action.mutateAsync({
              path: '/profile/',
              method: 'PATCH',
              body: Object.fromEntries(data),
            });
            setMessage('Links saved.');
          } catch {
            /*shown*/
          }
        }}
      >
        {[
          ['resume_url', 'Résumé', 'https://…'],
          ['linkedin_url', 'LinkedIn', 'https://linkedin.com/in/…'],
          ['github_url', 'GitHub', 'https://github.com/…'],
        ].map(([key, label, placeholder]) => (
          <label key={key}>
            {label}
            <input
              type="url"
              name={key}
              defaultValue={profile[key as 'resume_url' | 'linkedin_url' | 'github_url']}
              placeholder={placeholder}
              maxLength={500}
            />
          </label>
        ))}
        <ErrorNotice error={action.error} />
        <Toast message={message} />
        <button className="button secondary" disabled={action.isPending}>
          <BusyLabel busy={action.isPending}>Save links</BusyLabel>
        </button>
      </form>
    </section>
  );
}
