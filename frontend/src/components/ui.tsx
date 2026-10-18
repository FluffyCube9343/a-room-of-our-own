import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTags, useMe } from '../lib/hooks';
import type { Profile, Project, Room } from '../types';

export function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 26" fill="none" stroke="currentColor" strokeWidth="1.1">
          <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M2 21h20" />
          <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />
          <circle cx="15.5" cy="12.5" r=".45" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span>
        a room
        <br />
        <em>of our own.</em>
      </span>
    </span>
  );
}
export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const hue = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
  return (
    <span aria-hidden="true" className={`avatar avatar-${hue} ${large ? 'avatar-large' : ''}`}>
      {name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
}
export function MemberLink({
  member,
  children,
  className = '',
}: {
  member: { id: number; display_name: string };
  children?: ReactNode;
  className?: string;
}) {
  const { data } = useMe();
  return (
    <Link
      to={member.id === data?.user?.id ? '/profile' : `/members/${member.id}`}
      className={`member-link ${className}`}
      aria-label={`View ${member.display_name}'s profile`}
    >
      {children ?? member.display_name}
    </Link>
  );
}
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p className="lede">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function SectionHeading({
  title,
  to,
  label = 'Explore all',
}: {
  title: string;
  to?: string;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {to && (
        <Link className="text-link" to={to}>
          {label}
        </Link>
      )}
    </div>
  );
}
export function Tags({ ids, subtle = false }: { ids: number[]; subtle?: boolean }) {
  const { data } = useTags();
  return (
    <div className={`tags ${subtle ? 'tags-subtle' : ''}`}>
      {ids.map((id) => (
        <span className="tag" key={id}>
          {data?.results.find((t) => t.id === id)?.label || '…'}
        </span>
      ))}
    </div>
  );
}
export function TagPicker({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: number[];
  onChange: (ids: number[]) => void;
  error?: string;
}) {
  const query = useTags();
  return (
    <fieldset className="tag-picker">
      <legend>{label}</legend>
      {query.isPending ? (
        <p>Loading interests…</p>
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="tags">
          {query.data.results.map((tag) => (
            <button
              type="button"
              className={`tag tag-button ${value.includes(tag.id) ? 'selected' : ''}`}
              aria-pressed={value.includes(tag.id)}
              key={tag.id}
              onClick={() =>
                onChange(
                  value.includes(tag.id) ? value.filter((id) => id !== tag.id) : [...value, tag.id],
                )
              }
            >
              {tag.label}
            </button>
          ))}
        </div>
      )}
      {error && <small className="field-error">{error}</small>}
    </fieldset>
  );
}
export function ErrorNotice({ error, retry }: { error: Error | null; retry?: () => void }) {
  if (!error) return null;
  return (
    <div className="error-notice" role="alert">
      <p>{error.message}</p>
      {retry && (
        <button className="text-link" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading content-skeleton" role="status" aria-label="Loading content">
      <span className="sr-only">Loading…</span>
      <div className="skeleton skeleton-heading" aria-hidden="true" />
      <div className="skeleton skeleton-body" aria-hidden="true" />
      <div className="skeleton short" aria-hidden="true" />
    </div>
  );
}
export function EmptyState({
  title = 'Nothing here yet.',
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children && <div>{children}</div>}
    </div>
  );
}
export function BusyLabel({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <>{busy ? 'Please wait…' : children}</>;
}
export function Toast({ message }: { message: string }) {
  return message ? (
    <p className="toast" role="status">
      {message}
    </p>
  ) : null;
}
export function DateLabel({ value }: { value: string }) {
  return (
    <>
      {new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(value))}
    </>
  );
}
export function RoomCard({ room, index = 0 }: { room: Room; index?: number }) {
  return (
    <article className="room-card">
      {room.cover_url && (
        <Link
          className="room-art has-cover"
          to={`/rooms/${room.id}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          <img
            className="room-cover-image"
            src={room.cover_url}
            alt=""
            loading={index < 2 ? 'eager' : 'lazy'}
          />
        </Link>
      )}
      <div className="card-content">
        <h3>
          <Link to={`/rooms/${room.id}`}>{room.title}</Link>
        </h3>
        <p className="meta">
          {room.starts_at ? <DateLabel value={room.starts_at} /> : 'Ongoing conversation'}
        </p>
        <div className="card-bottom">
          <span className="byline">
            <MemberLink member={room.host} />
          </span>
          {room.rsvp_status === 'going' && <span className="small-success">Going</span>}
        </div>
      </div>
    </article>
  );
}
export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="project-card">
      <h3>
        <Link to={`/projects/${project.id}`}>{project.title}</Link>
      </h3>
      <p className="clamp-two">{project.description}</p>
      <div className="card-bottom">
        <MemberLink member={project.owner} />
        {project.status !== 'open' && <span className="meta">Closed</span>}
      </div>
    </article>
  );
}
export const promptLabels: Record<string, string> = {
  ask: 'Ask me about…',
  wish: 'I wish someone had told me…',
  learn: "I'm hoping to learn…",
};
export function MentorPreview({ profile }: { profile: Profile }) {
  return (
    <Link className="mentor-preview" to={`/members/${profile.id}`}>
      <Avatar name={profile.display_name} large />
      <div>
        <h3>{profile.display_name}</h3>
        <p>{profile.role}</p>
        {profile.reasons[0] && <span className="match-reason">{profile.reasons[0]}</span>}
      </div>
    </Link>
  );
}
export function CompatibilityReasons({ reasons }: { reasons: string[] }) {
  return (
    <div className="compatibility">
      <h3>Shared interests</h3>
      {reasons.map((reason) => (
        <p key={reason}>{reason}</p>
      ))}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} className="dialog">
      <div className="section-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ConfirmButton({
  label,
  title,
  children,
  onConfirm,
  busy = false,
  className = 'button secondary',
}: {
  label: ReactNode;
  title: string;
  children: ReactNode;
  onConfirm: () => Promise<unknown>;
  busy?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  return (
    <>
      <button
        className={className}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {label}
      </button>
      {open && (
        <Dialog title={title} onClose={() => !busy && setOpen(false)}>
          <p>{children}</p>
          <ErrorNotice error={error} />
          <div className="button-row">
            <button className="button secondary" disabled={busy} onClick={() => setOpen(false)}>
              Keep it
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                try {
                  await onConfirm();
                  setOpen(false);
                } catch (err) {
                  setError(err as Error);
                }
              }}
            >
              <BusyLabel busy={busy}>Confirm</BusyLabel>
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
export function Pagination({
  page,
  next,
  onChange,
}: {
  page: number;
  next: string | null;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <button className="button secondary" disabled={page === 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>Page {page}</span>
      <button className="button secondary" disabled={!next} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}
export function CommunityNote() {
  return (
    <div className="community-note">
      <p>A community for women in technology and business.</p>
    </div>
  );
}
