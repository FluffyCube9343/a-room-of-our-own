import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, Clock3, Plus, Users } from 'lucide-react';
import { useAction, useApi, useTags } from '../../lib/hooks';
import {
  Avatar,
  BusyLabel,
  ConfirmButton,
  DateLabel,
  EmptyState,
  ErrorNotice,
  Loading,
  MentorPreview,
  PageHeader,
  Pagination,
  ProjectCard,
  RoomCard,
  SectionHeading,
  TagPicker,
  Tags,
  Toast,
} from '../../components/ui';
import { SafetyActions } from '../safety/SafetyActions';
import type { Attendee, HomeData, Page, Room } from '../../types';

export function RoomsPage() {
  const [search, setSearch] = useSearchParams();
  const [page, setPage] = useState(1);
  const topic = search.get('topic') || '';
  const mine = search.get('mine') === '1';
  const tags = useTags();
  const query = useApi<Page<Room>>(
    `/rooms/?page=${page}&topic=${encodeURIComponent(topic)}${mine ? '&mine=1' : ''}`,
  );
  return (
    <>
      <PageHeader
        eyebrow="SMALL GATHERINGS. BIG POSSIBILITIES."
        title="There's a room for that."
        description="A place to ask a question, share a little knowledge, or simply belong."
        action={
          <Link className="button" to="/rooms/new">
            <Plus size={17} />
            Host a room
          </Link>
        }
      />
      <div className="browse-toolbar">
        <div className="tabs">
          <button
            className={!mine ? 'active' : ''}
            onClick={() => {
              setSearch({});
              setPage(1);
            }}
          >
            Upcoming rooms
          </button>
          <button
            className={mine ? 'active' : ''}
            onClick={() => {
              setSearch({ mine: '1' });
              setPage(1);
            }}
          >
            My rooms
          </button>
        </div>
        <label className="filter-label">
          Topic
          <select
            value={topic}
            onChange={(event) => {
              setSearch({
                ...(mine ? { mine: '1' } : {}),
                ...(event.target.value ? { topic: event.target.value } : {}),
              });
              setPage(1);
            }}
          >
            <option value="">All interests</option>
            {tags.data?.results.map((tag) => (
              <option key={tag.id} value={tag.slug}>
                {tag.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p className="results-caption">
            {query.data.count} {mine ? 'rooms you’re hosting' : 'open doors to something good'}
          </p>
          <div className="card-grid">
            {query.data.results.map((room, index) => (
              <RoomCard room={room} index={index} key={room.id} />
            ))}
          </div>
          {!query.data.results.length && (
            <EmptyState title="Make a little room for something new.">
              <p>No rooms here yet. Your conversation could be the first.</p>
              <Link className="button" to="/rooms/new">
                Host a room <Plus size={16} />
              </Link>
            </EmptyState>
          )}
          {query.data.count > 24 && (
            <Pagination page={page} next={query.data.next} onChange={setPage} />
          )}
        </>
      )}
    </>
  );
}
export function RoomDetail() {
  const { id } = useParams();
  const query = useApi<Room>(`/rooms/${id}/`);
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  return <RoomContent room={query.data} />;
}
function RoomContent({ room }: { room: Room }) {
  const action = useAction();
  const [message, setMessage] = useState('');
  const past = new Date(room.ends_at) <= new Date();
  const started = new Date(room.starts_at) <= new Date();
  const active = room.status === 'scheduled' && !past;
  const suggestions = useApi<HomeData>(`/home/?room=${room.id}`, room.rsvp_status === 'going');
  return (
    <>
      <Link to="/rooms" className="back-link">
        <ArrowLeft size={16} />
        All rooms
      </Link>
      <div className="detail-layout">
        <article>
          <div className="detail-art art-0">
            <span className="format-label">{room.format}</span>
            <div className="room-illustration" aria-hidden="true">
              <div className="illustration-arch" />
              <div className="illustration-circle" />
              <div className="illustration-step" />
            </div>
            <span className="detail-art-note">
              A little room.
              <br />A new possibility.
            </span>
          </div>
          <div className="detail-copy">
            <Tags ids={room.tags} />
            <h1>{room.title}</h1>
            <p className="byline">
              <Avatar name={room.host.display_name} />
              <span>
                Hosted by <strong>{room.host.display_name}</strong>
                <span className="block meta">{room.host.role}</span>
              </span>
            </p>
            <h2>What's this room about?</h2>
            <p className="preserve-lines">{room.description}</p>
            {!room.is_owner && (
              <SafetyActions memberId={room.host.id} target="room" targetId={room.id} />
            )}
          </div>
        </article>
        <aside>
          <section className="panel booking-panel">
            <p className="eyebrow">
              {room.status === 'cancelled'
                ? 'THIS ROOM IS CANCELLED'
                : past
                  ? 'THIS ROOM HAS ENDED'
                  : 'SAVE YOUR SEAT'}
            </p>
            <h2>A space for you.</h2>
            <p className="meta">
              <CalendarDays size={17} />
              <DateLabel value={room.starts_at} />
            </p>
            <p className="meta">
              <Clock3 size={17} />
              {Math.round((+new Date(room.ends_at) - +new Date(room.starts_at)) / 60000)} minutes ·
              Virtual
            </p>
            <p className="meta">
              <Users size={17} />
              {room.attendee_count} {room.attendee_count === 1 ? 'person' : 'people'} going
            </p>
            {room.is_owner ? (
              <div className="stack">
                <Link className="button" to={`/rooms/${room.id}/edit`}>
                  Edit room
                </Link>
                {room.status === 'scheduled' && (
                  <ConfirmButton
                    label="Cancel room"
                    title="Cancel this gathering?"
                    busy={action.isPending}
                    onConfirm={() =>
                      action.mutateAsync({
                        path: `/rooms/${room.id}/`,
                        method: 'PATCH',
                        body: { status: 'cancelled' },
                      })
                    }
                  >
                    Attendees will see that this room is cancelled, and the meeting link will no
                    longer be available to them.
                  </ConfirmButton>
                )}
              </div>
            ) : room.rsvp_status === 'going' ? (
              <div className="stack">
                {active && (
                  <p className="small-success">
                    <Check size={16} />
                    You're on the list. Make yourself at home.
                  </p>
                )}
                <ConfirmButton
                  label="Cancel my RSVP"
                  title="Give up your seat?"
                  busy={action.isPending}
                  onConfirm={async () => {
                    await action.mutateAsync({ path: `/rooms/${room.id}/rsvp/`, method: 'DELETE' });
                    setMessage('Your RSVP has been cancelled.');
                  }}
                >
                  You can RSVP again while the room is still accepting attendees.
                </ConfirmButton>
              </div>
            ) : (
              <button
                className="button full"
                disabled={action.isPending || !active || started || room.rsvp_status === 'removed'}
                onClick={async () => {
                  try {
                    await action.mutateAsync({ path: `/rooms/${room.id}/rsvp/`, method: 'PUT' });
                    setMessage("You're on the list. See you there!");
                  } catch {
                    /* shown below */
                  }
                }}
              >
                <BusyLabel busy={action.isPending}>
                  {room.rsvp_status === 'removed'
                    ? 'RSVP removed by host'
                    : !active || started
                      ? 'RSVPs are closed'
                      : 'Save me a seat'}
                  <ArrowUpRight size={17} />
                </BusyLabel>
              </button>
            )}
            {room.meeting_url && active && (
              <a
                className="button secondary full"
                href={room.meeting_url}
                target="_blank"
                rel="noreferrer"
              >
                Join room <ArrowUpRight size={17} />
              </a>
            )}
            <p className="form-footnote">
              {room.meeting_url?.includes('example.com')
                ? 'Demo room: this meeting link is a placeholder.'
                : 'Come curious. All experience levels welcome.'}
            </p>
            <ErrorNotice error={action.error} />
            <Toast message={message} />
          </section>
          {room.is_owner && <AttendeeList roomId={room.id} />}
        </aside>
      </div>
      {room.rsvp_status === 'going' && (
        <section className="content-section">
          <SectionHeading title="Keep the conversation growing" to="/connections" />
          {suggestions.isPending ? (
            <Loading />
          ) : suggestions.isError ? (
            <ErrorNotice error={suggestions.error} retry={() => void suggestions.refetch()} />
          ) : (
            <>
              <div className="people-grid">
                {suggestions.data?.mentors.slice(0, 2).map((profile) => (
                  <MentorPreview key={profile.id} profile={profile} />
                ))}
              </div>
              <div className="card-grid related-projects">
                {suggestions.data?.projects.slice(0, 3).map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
function AttendeeList({ roomId }: { roomId: number }) {
  const [page, setPage] = useState(1);
  const query = useApi<Page<Attendee>>(`/rooms/${roomId}/attendees/?page=${page}`);
  const action = useAction();
  return (
    <section className="panel">
      <h3>People in your room</h3>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.results.length && <p>No RSVPs yet. A little space for good company.</p>}
          {query.data.results.map((row) => (
            <div className="attendee-row" key={row.user.id}>
              <span>
                {row.user.display_name}
                <small className="block">{row.status}</small>
              </span>
              <ConfirmButton
                className="quiet-button"
                label={row.status === 'removed' ? 'Restore' : 'Remove'}
                title={row.status === 'removed' ? 'Restore RSVP access?' : 'Remove this attendee?'}
                busy={action.isPending}
                onConfirm={() =>
                  action.mutateAsync({
                    path: `/rooms/${roomId}/attendees/${row.user.id}/`,
                    method: 'PATCH',
                    body: { status: row.status === 'removed' ? 'cancelled' : 'removed' },
                  })
                }
              >
                {row.status === 'removed'
                  ? 'They will be able to RSVP again.'
                  : 'They will lose access to the meeting link and cannot RSVP again until you restore access.'}
              </ConfirmButton>
            </div>
          ))}
          {query.data.count > 24 && (
            <Pagination page={page} next={query.data.next} onChange={setPage} />
          )}
        </>
      )}
      <ErrorNotice error={action.error} />
    </section>
  );
}
const roomSchema = z
  .object({
    title: z.string().trim().min(3, 'Give your room a title.').max(140),
    description: z.string().trim().min(10, 'Tell people a little about the room.').max(4000),
    format: z.string(),
    tags: z.array(z.number()).min(1, 'Choose a topic.'),
    starts_at: z.string().min(1, 'Choose a start time.'),
    ends_at: z.string().min(1, 'Choose an end time.'),
    meeting_url: z
      .url('Enter a valid meeting URL.')
      .startsWith('https://', 'Use an https:// link.'),
  })
  .refine((value) => new Date(value.ends_at) > new Date(value.starts_at), {
    message: 'End time must be after the start.',
    path: ['ends_at'],
  });
type RoomValues = z.infer<typeof roomSchema>;
function localDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function RoomEditor() {
  const { id } = useParams();
  const query = useApi<Room>(`/rooms/${id}/`, !!id);
  if (id && query.isPending) return <Loading />;
  if (id && query.isError)
    return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  if (id && !query.data?.is_owner) return <EmptyState title="Only the host can edit this room." />;
  return <RoomForm key={id || 'new'} room={query.data} />;
}
function RoomForm({ room }: { room?: Room }) {
  const action = useAction<Room>();
  const navigate = useNavigate();
  const form = useForm<RoomValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      title: room?.title || '',
      description: room?.description || '',
      format: room?.format || 'conversation',
      tags: room?.tags || [],
      starts_at: localDate(room?.starts_at),
      ends_at: localDate(room?.ends_at),
      meeting_url: room?.meeting_url || '',
    },
  });
  const errors = form.formState.errors;
  return (
    <div className="form-page">
      <Link className="back-link" to={room ? `/rooms/${room.id}` : '/rooms'}>
        <ArrowLeft size={16} />
        Back to rooms
      </Link>
      <PageHeader
        eyebrow="OPEN A DOOR FOR SOMEONE"
        title={room ? 'Make it your own.' : 'Make a little room.'}
        description="A good conversation starts with an invitation."
      />
      <form
        className="panel"
        onSubmit={form.handleSubmit(async (values) => {
          const body = {
            ...values,
            starts_at: new Date(values.starts_at).toISOString(),
            ends_at: new Date(values.ends_at).toISOString(),
          };
          if (room && body.starts_at === new Date(room.starts_at).toISOString()) {
            const { starts_at: _start, ...rest } = body;
            void _start;
            try {
              const result = await action.mutateAsync({
                path: `/rooms/${room.id}/`,
                method: 'PATCH',
                body: rest,
              });
              navigate(`/rooms/${result.id}`);
            } catch {
              /* below */
            }
            return;
          }
          try {
            const result = await action.mutateAsync({
              path: room ? `/rooms/${room.id}/` : '/rooms/',
              method: room ? 'PATCH' : 'POST',
              body,
            });
            navigate(`/rooms/${result.id}`);
          } catch {
            /* below */
          }
        })}
      >
        <label>
          Give your room a name
          <input
            {...form.register('title')}
            placeholder="e.g. Coffee, code & a little company"
            maxLength={140}
          />
          <small className="field-error">{errors.title?.message}</small>
        </label>
        <label>
          What's the invitation?
          <textarea
            {...form.register('description')}
            rows={5}
            maxLength={4000}
            placeholder="What will you do together? Who should come along?"
          />
          <small className="field-error">{errors.description?.message}</small>
        </label>
        <label>
          Room format
          <select {...form.register('format')}>
            <option value="conversation">Conversation</option>
            <option value="workshop">Workshop</option>
            <option value="panel">Panel</option>
            <option value="coworking">Co-working</option>
          </select>
        </label>
        <Controller
          name="tags"
          control={form.control}
          render={({ field }) => (
            <TagPicker
              label="What will you explore?"
              value={field.value}
              onChange={field.onChange}
              error={errors.tags?.message}
            />
          )}
        />
        <div className="form-two">
          <label>
            Starts
            <input type="datetime-local" {...form.register('starts_at')} />
            <small className="field-error">{errors.starts_at?.message}</small>
          </label>
          <label>
            Ends
            <input type="datetime-local" {...form.register('ends_at')} />
            <small className="field-error">{errors.ends_at?.message}</small>
          </label>
        </div>
        <p className="form-footnote">
          Times are entered in {Intl.DateTimeFormat().resolvedOptions().timeZone} and shown in each
          viewer's timezone.
        </p>
        <label>
          Meeting link
          <input type="url" {...form.register('meeting_url')} placeholder="https://…" />
          <small>Only you and active registered attendees can see this link.</small>
          <small className="field-error">{errors.meeting_url?.message}</small>
        </label>
        <ErrorNotice error={action.error} />
        <button className="button full" disabled={action.isPending}>
          <BusyLabel busy={action.isPending}>
            {room ? 'Save changes' : 'Open my room'}
            <ArrowUpRight size={17} />
          </BusyLabel>
        </button>
      </form>
    </div>
  );
}
