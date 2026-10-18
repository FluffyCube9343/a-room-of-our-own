import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ErrorNotice } from '../../components/ui';
import type { Profile, ProfilePhoto, User } from '../../types';

export function useAutosave({
  value,
  path = '/profile/',
  validationError = '',
  enabled = true,
}: {
  value: object;
  path?: string;
  validationError?: string;
  enabled?: boolean;
}) {
  const serialized = JSON.stringify(value);
  const saved = useRef(serialized);
  const queued = useRef(0);
  const lastSubmitted = useRef(serialized);
  const failed = useRef<string | null>(null);
  const latest = useRef({ serialized, validationError, enabled });
  latest.current = { serialized, validationError, enabled };
  const [, render] = useState(0);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: ['profile-autosave'],
    scope: { id: 'profile-edits' },
    mutationFn: (body: string) => {
      const next = JSON.parse(body);
      const previous = JSON.parse(saved.current);
      const changes = Object.fromEntries(
        Object.entries(next).filter(
          ([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key]),
        ),
      );
      if (['academic_stage', 'major', 'profession'].some((key) => key in changes)) {
        for (const key of ['academic_stage', 'major', 'profession']) changes[key] = next[key];
      }
      return api<Profile | ProfilePhoto | { email: string }>(path, 'PATCH', changes);
    },
    onSuccess: (result, body) => {
      client.setQueryData<{ user: User | null }>(['me'], (current) => {
        if (!current?.user) throw new Error('Your session ended while saving. Sign in again.');
        if (path === '/account/' && 'email' in result)
          return { user: { ...current.user, email: result.email } };
        if (path === '/profile/' && 'display_name' in result) {
          const fields = Object.keys(JSON.parse(body)) as (keyof Profile)[];
          if (fields.includes('academic_stage')) fields.push('role');
          if (fields.includes('purposes')) fields.push('intent');
          const updated = Object.fromEntries(fields.map((field) => [field, result[field]]));
          return { user: { ...current.user, profile: { ...current.user.profile, ...updated } } };
        }
        if (/^\/profile\/photos\/\d+\/$/.test(path) && 'caption' in result)
          return {
            user: {
              ...current.user,
              profile: {
                ...current.user.profile,
                photos: current.user.profile.photos.map((photo) =>
                  photo.id === result.id ? result : photo,
                ),
              },
            },
          };
        throw new Error('Unexpected response while saving your profile. Refresh and try again.');
      });
      saved.current = body;
      failed.current = null;
      void client.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== 'me',
        refetchType: 'none',
      });
    },
    onError: (_error, body) => {
      failed.current = body;
    },
    onSettled: () => {
      queued.current -= 1;
      render((version) => version + 1);
    },
  });
  const flush = (retry = false) => {
    const current = latest.current;
    if (!current.enabled || current.validationError) return;
    if (
      current.serialized === lastSubmitted.current &&
      (queued.current > 0 || current.serialized === saved.current)
    )
      return;
    if (current.serialized === saved.current && queued.current === 0) return;
    if (!retry && failed.current === current.serialized) return;
    queued.current += 1;
    lastSubmitted.current = current.serialized;
    mutation.mutate(current.serialized);
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    if (!enabled || validationError) return;
    const timeout = window.setTimeout(() => flushRef.current(), 600);
    return () => window.clearTimeout(timeout);
  }, [serialized, enabled, validationError]);
  const dirty = serialized !== saved.current;
  const error = dirty ? (validationError ? new Error(validationError) : mutation.error) : null;
  return {
    flush: () => flush(),
    retry: error && !validationError ? () => flush(true) : undefined,
    error,
    pending: mutation.isPending || queued.current > 0,
    dirty,
  };
}

export function AutosaveStatus({ save }: { save: ReturnType<typeof useAutosave> }) {
  return (
    <div className="profile-save-status">
      <span role="status" aria-live="polite">
        {save.error
          ? 'Changes not saved'
          : save.pending
            ? 'Saving…'
            : save.dirty
              ? 'Unsaved changes'
              : 'All changes saved'}
      </span>
      <ErrorNotice error={save.error} retry={save.retry} />
    </div>
  );
}
