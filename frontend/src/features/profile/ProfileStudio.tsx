import { useRef, useState } from 'react';
import { z } from 'zod';
import { ArrowDown, ArrowUp, Camera, Eye, EyeOff, Plus, Trash2, Upload } from 'lucide-react';
import { useAction, useApi } from '../../lib/hooks';
import { ConfirmButton, ErrorNotice, Loading, Toast } from '../../components/ui';
import type { Profile, ProfilePhoto, Prompt, PromptOption } from '../../types';
import { AutosaveStatus, useAutosave } from './useAutosave';

export function PromptEditor({ profile }: { profile: Profile }) {
  const bank = useApi<{ results: PromptOption[] }>('/profile/prompt-options/');
  const [prompts, setPrompts] = useState<Prompt[]>(profile.prompts);
  const [pick, setPick] = useState('');
  const save = useAutosave({
    value: {
      prompts: prompts.map((prompt, order) => ({ ...prompt, answer: prompt.answer.trim(), order })),
    },
    validationError: prompts.some((prompt) => !prompt.answer.trim())
      ? 'Add an answer to each prompt, or remove the empty prompt.'
      : '',
  });
  const shown = prompts.filter((p) => p.visible).length;
  const update = (index: number, changes: Partial<Prompt>) =>
    setPrompts(prompts.map((p, i) => (i === index ? { ...p, ...changes } : p)));
  const move = (index: number, by: number) => {
    const next = [...prompts];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setPrompts(next);
  };
  return (
    <section className="panel prompt-editor" onBlurCapture={() => save.flush()}>
      <div className="section-heading">
        <div>
          <h2>Prompts</h2>
        </div>
        <span className="count-pill">{shown} / 3 showing</span>
      </div>

      {prompts.map((prompt, index) => (
        <div className={`editable-prompt ${prompt.visible ? '' : 'draft-prompt'}`} key={prompt.key}>
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
            Add a prompt
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose a prompt…</option>
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
      <AutosaveStatus save={save} />
    </section>
  );
}
export function PhotoEditor({ photos }: { photos: ProfilePhoto[] }) {
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
          <h2>Photos</h2>
        </div>
        <span className="count-pill">{photos.length} / 6</span>
      </div>

      <div className="photo-edit-grid">
        {photos.map((photo, index) => (
          <div className="photo-editor-card" key={photo.id}>
            <div className="photo-edit-image">
              <img src={photo.url} alt={photo.caption || `Your profile photo ${index + 1}`} />
              {index === 0 && <span className="photo-lead-label">Profile cover</span>}
            </div>
            <details className="photo-caption-editor">
              <summary>Caption</summary>
              <PhotoCaption photo={photo} />
            </details>
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
            <span>Add Photo(s)</span>
            <small>JPG, PNG, WebP · up to 5 MB</small>
          </button>
        )}
      </div>
      <input
        ref={input}
        className="sr-only"
        type="file"
        aria-label="Upload profile photos"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={async (event) => {
          const files = Array.from(event.target.files || []);
          if (!files.length) return;
          setError(null);
          setMessage('');
          if (files.length + photos.length > 6) {
            setError(
              new Error(`You can add ${6 - photos.length} more photo(s). Choose fewer files.`),
            );
            event.target.value = '';
            return;
          }
          if (files.some((file) => file.size > 5 * 1024 * 1024)) {
            setError(new Error('Choose a photo under 5 MB.'));
            event.target.value = '';
            return;
          }
          if (
            files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
          ) {
            setError(new Error('Choose JPEG, PNG, or WebP photos.'));
            event.target.value = '';
            return;
          }
          try {
            for (const file of files) {
              const body = new FormData();
              body.append('image', file);
              await action.mutateAsync({ path: '/profile/photos/', body });
            }
            setMessage(files.length === 1 ? 'Photo added.' : 'Photos added.');
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
  const save = useAutosave({ value: { caption }, path: `/profile/photos/${photo.id}/` });
  return (
    <form
      className="caption-form"
      onBlurCapture={() => save.flush()}
      onSubmit={(event) => {
        event.preventDefault();
        save.flush();
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
      <AutosaveStatus save={save} />
    </form>
  );
}
export function ProfessionalLinksEditor({ profile }: { profile: Profile }) {
  const [links, setLinks] = useState({
    resume_url: profile.resume_url,
    linkedin_url: profile.linkedin_url,
    github_url: profile.github_url,
  });
  const validation = z
    .object({
      resume_url: z.union([z.literal(''), z.url().startsWith('https://')]),
      linkedin_url: z.union([
        z.literal(''),
        z
          .url()
          .startsWith('https://')
          .refine(
            (value) => /^https:\/\/(www\.)?linkedin\.com(?:\/|$)/i.test(value),
            'Use a linkedin.com profile link.',
          ),
      ]),
      github_url: z.union([
        z.literal(''),
        z
          .url()
          .startsWith('https://')
          .refine(
            (value) => /^https:\/\/(www\.)?github\.com(?:\/|$)/i.test(value),
            'Use a github.com profile link.',
          ),
      ]),
    })
    .safeParse(links);
  const save = useAutosave({
    value: links,
    validationError: validation.success
      ? ''
      : 'Use a valid https:// link for each field, with LinkedIn and GitHub links on their own sites.',
  });
  return (
    <section className="panel">
      <form
        onBlurCapture={() => save.flush()}
        onSubmit={(event) => {
          event.preventDefault();
          save.flush();
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
              value={links[key as keyof typeof links]}
              onChange={(event) => setLinks({ ...links, [key]: event.target.value })}
              placeholder={placeholder}
              maxLength={500}
            />
          </label>
        ))}
        <AutosaveStatus save={save} />
      </form>
    </section>
  );
}
