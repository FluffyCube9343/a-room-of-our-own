import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  DoorOpen,
  LoaderCircle,
  MessageCircle,
  Plus,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTags } from '../lib/hooks';
import type { Profile, Project, Room } from '../types';

export function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <DoorOpen size={23} strokeWidth={1.5} />
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
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
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
          <ArrowRight size={16} />
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
              {value.includes(tag.id) ? <Check size={14} /> : <Plus size={14} />}
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
          Try again <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>Making a little room…</span>
      <div className="skeleton" />
      <div className="skeleton short" />
    </div>
  );
}
export function EmptyState({
  title = 'A little space for something new.',
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <DoorOpen size={30} strokeWidth={1.3} />
      <h3>{title}</h3>
      <div>{children || 'Check back soon, or be the first to start something.'}</div>
    </div>
  );
}
export function BusyLabel({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <>
      {busy && <LoaderCircle size={16} className="spin" />}
      {busy ? 'One moment…' : children}
    </>
  );
}
export function Toast({ message }: { message: string }) {
  return message ? (
    <p className="toast" role="status">
      <Check size={16} />
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
export function RoomCard({
  room,
  index = 0,
  recommended = false,
}: {
  room: Room;
  index?: number;
  recommended?: boolean;
}) {
  const date = room.starts_at ? new Date(room.starts_at) : null;
  return (
    <article className="room-card">
      <div className={`room-art art-${index % 3} ${room.cover_url ? 'has-cover' : ''}`}>
        {room.cover_url && (
          <img className="room-cover-image" src={room.cover_url} alt="" loading="lazy" />
        )}
        <span className="format-label">
          <span className="status-dot" />
          {room.format === 'coworking'
            ? 'Co-working'
            : room.format === 'chatroom'
              ? 'Topic chatroom'
              : room.format}
        </span>
        <div className="room-illustration" aria-hidden="true" hidden={!!room.cover_url}>
          <div className="illustration-arch" />
          <div className="illustration-circle" />
          <div className="illustration-step" />
        </div>
        <span className="date-tile">
          {date ? (
            <>
              <strong>{date.getDate()}</strong>
              {date.toLocaleDateString(undefined, { month: 'short' })}
            </>
          ) : (
            <>
              <MessageCircle size={28} strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">Topic chatroom</span>
            </>
          )}
        </span>
      </div>
      <div className="card-content">
        {recommended && !!room.matching_interests?.length && (
          <p className="room-match">
            <Sparkles size={13} /> Matches your {room.matching_interests.slice(0, 2).join(' & ')}{' '}
            interests
          </p>
        )}
        <Tags ids={room.tags.slice(0, 2)} subtle />
        <h3>
          <Link to={`/rooms/${room.id}`}>{room.title}</Link>
        </h3>
        <p className="meta">
          <CalendarDays size={14} />
          {room.starts_at ? <DateLabel value={room.starts_at} /> : 'Ongoing conversation'}
        </p>
        <p className="meta">{room.location_type}</p>
        <div className="card-bottom">
          <span className="byline">
            <Avatar name={room.host.display_name} />
            <span>
              Hosted by <strong>{room.host.display_name.split(' ')[0]}</strong>
            </span>
          </span>
          {room.rsvp_status === 'going' ? (
            <span className="small-success">
              <Check size={14} />
              Going
            </span>
          ) : (
            <Link
              to={`/rooms/${room.id}`}
              className="circle-link"
              aria-label={`View ${room.title}`}
            >
              <ArrowUpRight size={19} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="project-card">
      <div className="project-card-top">
        <span className="project-icon">
          <Sparkles size={22} strokeWidth={1.4} />
        </span>
        <span className="tiny-label">
          {project.status === 'open' ? 'OPEN TO COLLABORATORS' : 'PROJECT CLOSED'}
        </span>
      </div>
      <h3>
        <Link to={`/projects/${project.id}`}>{project.title}</Link>
      </h3>
      <p className="clamp-two">{project.description}</p>
      <div className="needs">
        <span>Looking for</span>
        <Tags ids={project.needed_skills} subtle />
      </div>
      <div className="card-bottom">
        <span className="byline">
          <Avatar name={project.owner.display_name} />
          <strong>{project.owner.display_name}</strong>
        </span>
        <Link
          to={`/projects/${project.id}`}
          className="circle-link"
          aria-label={`View ${project.title}`}
        >
          <ArrowUpRight size={19} />
        </Link>
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
        <span className="match-reason">
          <Sparkles size={13} />
          {profile.reasons[0]}
        </span>
      </div>
      <ArrowUpRight size={20} />
    </Link>
  );
}
export function CompatibilityReasons({ reasons }: { reasons: string[] }) {
  return (
    <div className="compatibility">
      <span className="eyebrow">
        <Sparkles size={14} />A little common ground
      </span>
      {reasons.map((reason) => (
        <p key={reason}>
          <Check size={14} />
          {reason}
        </p>
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
          <X size={20} />
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
        Next <ArrowRight size={16} />
      </button>
    </div>
  );
}
export function CommunityNote() {
  return (
    <div className="community-note">
      <Users size={17} />
      <p>Women-centered. Gender-inclusive. A little more possible, together.</p>
    </div>
  );
}
