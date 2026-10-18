import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Plus,
  Users,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useAction, useApi, useTags, useMe } from '../../lib/hooks';
import { api } from '../../lib/api';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Avatar,
  MemberLink,
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
import { RoomChannel } from './RoomChannel';
import { SafetyActions } from '../safety/SafetyActions';
import type { Attendee, HomeData, Page, Room } from '../../types';

export function RoomsPage() {
  const [search, setSearch] = useSearchParams();
  const [page, setPage] = useState(1);
  const topic = search.get('topic') || '';
  const mine = search.get('mine') === '1';
  const term = search.get('q') || '';
  const kind = search.get('format') || '';
  const feed = search.get('feed') === 'all' ? 'all' : 'for-you';
  const personalized = !mine && feed === 'for-you';
  const { data: me } = useMe();
  const [debouncedTerm, setDebouncedTerm] = useState(term);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), 300);
    return () => clearTimeout(timer);
  }, [term]);
  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearch(next, { replace: true });
    setPage(1);
  };
  const tags = useTags();
  const path = `/rooms/?page=${page}&topic=${encodeURIComponent(topic)}&q=${encodeURIComponent(debouncedTerm)}&kind=${kind}&feed=${feed}${mine ? '&mine=1' : ''}`;
  const query = useQuery({
    queryKey: [path],
    queryFn: () => api<Page<Room>>(path),
    placeholderData: keepPreviousData,
  });
  const interestTags =
    tags.data?.results.filter((tag) => me?.user?.profile.interests.includes(tag.id)) || [];
  const hasFilters = !!(term || kind || topic);
  const clearFilters = () => {
    setSearch(mine ? { mine: '1' } : feed === 'all' ? { feed: 'all' } : {});
    setPage(1);
  };
  const selectFeed = (value: string) => {
    const next = new URLSearchParams(search);
    next.delete('mine');
    next.delete('feed');
    if (value === 'mine') next.set('mine', '1');
    else if (value === 'all') next.set('feed', 'all');
    setSearch(next);
    setPage(1);
  };
  return (
    <>
      <PageHeader
        title="There's a room for that."
        description="A place to ask a question, share a little knowledge, or simply belong."
        action={
          <Link className="button" to="/rooms/new">
            <Plus size={17} />
            Host a room
          </Link>
        }
      />
      <section className="rooms-discovery" aria-label="Find a room">
        <div className="rooms-feed-tabs" aria-label="Room feeds">
          <button type="button" aria-pressed={personalized} onClick={() => selectFeed('for-you')}>
            <Sparkles size={16} />
            For you
          </button>
          <button
            type="button"
            aria-pressed={!mine && feed === 'all'}
            onClick={() => selectFeed('all')}
          >
            All rooms
          </button>
          <button type="button" aria-pressed={mine} onClick={() => selectFeed('mine')}>
            My rooms
          </button>
        </div>
        <div className="rooms-search-row">
          <label className="rooms-search-field">
            <span>Search rooms</span>
            <div>
              <Search size={19} aria-hidden="true" />
              <input
                type="search"
                value={term}
                onChange={(event) => updateFilter('q', event.target.value)}
                placeholder="Search by name, topic, or host"
              />
            </div>
          </label>
          <label>
            <span>Room type</span>
            <select value={kind} onChange={(event) => updateFilter('format', event.target.value)}>
              <option value="">All types</option>
              <option value="chatroom">Topic chatrooms</option>
              <option value="conversation">Conversations</option>
              <option value="workshop">Workshops</option>
              <option value="panel">Panels</option>
              <option value="coworking">Co-working</option>
            </select>
          </label>
          <label>
            <span>Topic</span>
            <select value={topic} onChange={(event) => updateFilter('topic', event.target.value)}>
              <option value="">All topics</option>
              {tags.data?.results.map((tag) => (
                <option key={tag.id} value={tag.slug}>
                  {tag.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="rooms-filter-footer">
          {personalized ? (
            <div className="rooms-interest-chips">
              <span>Your interests</span>
              {interestTags.length ? (
                interestTags.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    aria-pressed={topic === tag.slug}
                    onClick={() => updateFilter('topic', topic === tag.slug ? '' : tag.slug)}
                  >
                    {tag.label}
                  </button>
                ))
              ) : (
                <Link to="/profile/edit">Add interests to personalize your rooms</Link>
              )}
            </div>
          ) : (
            <span className="meta">
              {mine
                ? 'Rooms you host or help organize.'
                : 'Explore every topic and find something new.'}
            </span>
          )}
          {hasFilters && (
            <button type="button" className="rooms-clear" onClick={clearFilters}>
              <X size={14} />
              Clear filters
            </button>
          )}
        </div>
      </section>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="rooms-results-heading">
            <div>
              <h2>{personalized ? 'A little more you.' : mine ? 'Your rooms' : 'Explore rooms'}</h2>
              <p className="meta">
                {personalized
                  ? interestTags.length
                    ? 'Rooms matching your interests appear first. There is always more to explore below.'
                    : 'Explore rooms now, or add interests to get personalized recommendations.'
                  : 'Find your next conversation, session, or community.'}
              </p>
            </div>
            <p className="results-caption" role="status">
              {query.isFetching
                ? 'Updating...'
                : `${query.data.count} ${query.data.count === 1 ? 'room' : 'rooms'}`}
            </p>
          </div>
          <div className="card-grid">
            {query.data.results.map((room, index) => (
              <RoomCard room={room} index={index} key={room.id} recommended={personalized} />
            ))}
          </div>
          {!query.data.results.length && (
            <EmptyState
              title={
                hasFilters
                  ? 'No rooms match these filters.'
                  : 'Make a little room for something new.'
              }
            >
              {hasFilters ? (
                <button className="button secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : (
                <p>No rooms here yet. Your conversation could be the first.</p>
              )}
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
  const chat = room.format === 'chatroom';
  const past = !!room.ends_at && new Date(room.ends_at) <= new Date();
  const started = !chat && !!room.starts_at && new Date(room.starts_at) <= new Date();
  const active = room.status === 'scheduled' && !past;
  const suggestions = useApi<HomeData>(`/home/?room=${room.id}`, room.rsvp_status === 'going');
  return (
    <>
      <Link to="/rooms" className="back-link">
        <ArrowLeft size={16} />
        All rooms
      </Link>
      {chat && active && (room.can_edit || room.rsvp_status === 'going') && (
        <RoomChannel key={room.id} room={room} />
      )}
      <details
        className="room-details"
        open={!(chat && active && (room.can_edit || room.rsvp_status === 'going'))}
      >
        <summary>{chat ? 'About this room & settings' : 'Room details'}</summary>
        <div className="detail-layout">
          <article>
            <div className={`detail-art art-0 ${room.cover_url ? 'has-cover' : ''}`}>
              {room.cover_url && <img className="room-cover-image" src={room.cover_url} alt="" />}
              <span className="format-label">{chat ? 'Topic chatroom' : room.format}</span>
              <div className="room-illustration" aria-hidden="true" hidden={!!room.cover_url}>
                <div className="illustration-arch" />
                <div className="illustration-circle" />
                <div className="illustration-step" />
              </div>
              <span className="detail-art-note" hidden={!!room.cover_url}>
                A little room.
                <br />A new possibility.
              </span>
            </div>
            {room.cover_credit && (
              <details className="cover-credit">
                <summary>Photo credit</summary>
                <p>{room.cover_credit}</p>
              </details>
            )}
            <div className="detail-copy">
              <Tags ids={room.tags} />
              <h1>{room.title}</h1>
              <p className="byline">
                <MemberLink member={room.host}>
                  <Avatar name={room.host.display_name} />
                </MemberLink>
                <span>
                  Hosted by{' '}
                  <strong>
                    <MemberLink member={room.host} />
                  </strong>
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
                    : chat
                      ? 'JOIN THE CONVERSATION'
                      : 'SAVE YOUR SEAT'}
              </p>
              <h2>A space for you.</h2>
              <p className="meta">
                <CalendarDays size={17} />
                {room.starts_at ? <DateLabel value={room.starts_at} /> : 'Ongoing topic chatroom'}
              </p>
              <p className="meta">
                <Clock3 size={17} />
                {room.ends_at && room.starts_at
                  ? `${Math.round((+new Date(room.ends_at) - +new Date(room.starts_at)) / 60000)} minutes · `
                  : ''}
                {room.location_type}
              </p>
              <p className="meta">
                <Users size={17} />
                {room.attendee_count} {room.attendee_count === 1 ? 'person' : 'people'}{' '}
                {chat ? 'joined' : 'going'}
              </p>
              {room.can_edit ? (
                <div className="stack">
                  <Link className="button" to={`/rooms/${room.id}/edit`}>
                    Edit room
                  </Link>
                  {room.is_owner && room.status === 'scheduled' && (
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
                    label={chat ? 'Leave chatroom' : 'Cancel my RSVP'}
                    title="Give up your seat?"
                    busy={action.isPending}
                    onConfirm={async () => {
                      await action.mutateAsync({
                        path: `/rooms/${room.id}/rsvp/`,
                        method: 'DELETE',
                      });
                      setMessage('Your RSVP has been cancelled.');
                    }}
                  >
                    You can RSVP again while the room is still accepting attendees.
                  </ConfirmButton>
                </div>
              ) : (
                <button
                  className="button full"
                  disabled={
                    action.isPending || !active || started || room.rsvp_status === 'removed'
                  }
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
                        : chat
                          ? 'Join chatroom'
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
              {room.physical_location && active && (
                <p className="preserve-lines">
                  <strong>Physical location</strong>
                  <br />
                  {room.physical_location}
                </p>
              )}
              {!room.can_edit && room.rsvp_status !== 'going' && (
                <p className="form-footnote">
                  Join to see location details{chat ? ' and the conversation' : ''}.
                </p>
              )}
              {!room.is_owner && active && <CollaboratorRequest room={room} />}
              <p className="form-footnote">
                {room.meeting_url?.includes('example.com')
                  ? 'Demo room: this meeting link is a placeholder.'
                  : 'Come curious. All experience levels welcome.'}
              </p>
              <ErrorNotice error={action.error} />
              <Toast message={message} />
            </section>
            {room.is_owner && <AttendeeList roomId={room.id} />}
            {room.is_owner && <CollaboratorList roomId={room.id} />}
          </aside>
        </div>
      </details>
      {!chat && room.rsvp_status === 'going' && (
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
function CollaboratorRequest({ room }: { room: Room }) {
  const action = useAction();
  return (
    <div className="stack">
      {room.collaboration_status ? (
        <p className="meta">
          {room.collaboration_status === 'approved'
            ? 'You are a collaborator.'
            : room.collaboration_status === 'pending'
              ? 'Collaboration request sent. Waiting for the host.'
              : 'The host declined your collaboration request.'}
        </p>
      ) : (
        <button
          type="button"
          className="button secondary"
          disabled={action.isPending || room.rsvp_status === 'removed'}
          onClick={() =>
            void action.mutateAsync({ path: `/rooms/${room.id}/collaborators/` }).catch(() => {})
          }
        >
          Request to collaborate
        </button>
      )}
      <ErrorNotice error={action.error} />
    </div>
  );
}

function CollaboratorList({ roomId }: { roomId: number }) {
  const [page, setPage] = useState(1);
  const query = useApi<Page<{ user: Attendee['user']; status: string }>>(
    `/rooms/${roomId}/collaborators/?page=${page}`,
  );
  const action = useAction();
  return (
    <section className="panel">
      <h3>Collaborators</h3>
      <p className="form-footnote">
        Approved collaborators can edit room details and participate in chat. Only you can cancel
        the room and manage access.
      </p>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} />
      ) : (
        <>
          {!query.data.results.length && <p>No collaboration requests yet.</p>}
          {query.data.results.map((row) => (
            <div className="attendee-row" key={row.user.id}>
              <span>
                <MemberLink member={row.user} />
                <small className="block">{row.status}</small>
              </span>
              <div className="button-row">
                {(row.status === 'pending'
                  ? ['approved', 'declined']
                  : row.status === 'approved'
                    ? ['declined']
                    : []
                ).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="quiet-button"
                    disabled={action.isPending}
                    onClick={() =>
                      void action
                        .mutateAsync({
                          path: `/rooms/${roomId}/collaborators/`,
                          method: 'PATCH',
                          body: { user_id: row.user.id, status },
                        })
                        .catch(() => {})
                    }
                  >
                    {status === 'approved'
                      ? 'Approve'
                      : row.status === 'approved'
                        ? 'Revoke access'
                        : 'Decline'}
                  </button>
                ))}
              </div>
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
                <MemberLink member={row.user} />
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
    starts_at: z.string(),
    ends_at: z.string(),
    physical_location: z.string().trim().max(500),
    meeting_url: z.union([
      z.literal(''),
      z.url('Enter a valid meeting URL.').startsWith('https://', 'Use an https:// link.'),
    ]),
  })
  .refine(
    (value) => value.format === 'chatroom' || new Date(value.ends_at) > new Date(value.starts_at),
    {
      message: 'End time must be after the start.',
      path: ['ends_at'],
    },
  )
  .refine(
    (value) => value.format === 'chatroom' || !!value.meeting_url || !!value.physical_location,
    {
      message: 'Add a physical location, a virtual meeting link, or both.',
      path: ['physical_location'],
    },
  );
type RoomValues = z.infer<typeof roomSchema>;
function localDate(value?: string | null) {
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
  if (id && !query.data?.can_edit)
    return <EmptyState title="Only the host and approved collaborators can edit this room." />;
  return <RoomForm key={id || 'new'} room={query.data} />;
}
function RoomForm({ room }: { room?: Room }) {
  const action = useAction<Room>();
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverError, setCoverError] = useState('');
  const [removeCover, setRemoveCover] = useState(false);
  useEffect(() => {
    if (!cover) {
      setCoverPreview('');
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);
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
      physical_location: room?.physical_location || '',
    },
  });
  const errors = form.formState.errors;
  const chat = form.watch('format') === 'chatroom';
  const title = form.watch('title');
  const selectedTags = form.watch('tags').join(',');
  const [similarQuery, setSimilarQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(
      () => setSimilarQuery(`title=${encodeURIComponent(title)}&tags=${selectedTags}`),
      400,
    );
    return () => clearTimeout(timer);
  }, [title, selectedTags]);
  const similar = useApi<{ results: Room[] }>(
    `/rooms/similar/?${similarQuery}`,
    !room && !!similarQuery,
  );
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
          if (coverError) return;
          const fields: Record<string, unknown> = {
            ...values,
            starts_at: chat ? null : new Date(values.starts_at).toISOString(),
            ends_at: chat ? null : new Date(values.ends_at).toISOString(),
          };
          if (room?.starts_at && fields.starts_at === new Date(room.starts_at).toISOString())
            delete fields.starts_at;
          if (removeCover) fields.cover_image = null;
          let body: unknown = fields;
          if (cover) {
            const upload = new FormData();
            for (const [key, value] of Object.entries(fields)) {
              if (value === null) continue;
              if (Array.isArray(value)) value.forEach((item) => upload.append(key, String(item)));
              else upload.append(key, String(value));
            }
            upload.append('cover_image', cover);
            body = upload;
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
        <section className="room-cover-picker">
          <label>
            Cover photo (optional)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (
                  file.size > 5 * 1024 * 1024 ||
                  !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
                ) {
                  setCoverError('Choose a JPEG, PNG, or WebP under 5 MB.');
                  event.target.value = '';
                  return;
                }
                setCoverError('');
                setRemoveCover(false);
                setCover(file);
              }}
            />
            <small>A landscape photo works best. JPEG, PNG, or WebP, up to 5 MB.</small>
          </label>
          {(coverPreview || (!removeCover && room?.cover_url)) && (
            <>
              <img
                className="room-cover-preview"
                src={coverPreview || room!.cover_url!}
                alt="Room cover preview"
              />
              <button
                type="button"
                className="quiet-button"
                onClick={() => {
                  setCover(null);
                  setRemoveCover(true);
                  setCoverError('');
                }}
              >
                Remove cover
              </button>
            </>
          )}
          {coverError && (
            <p className="field-error" role="alert">
              {coverError}
            </p>
          )}
        </section>
        <label>
          Give your room a name
          <input
            {...form.register('title')}
            placeholder="e.g. Coffee, code & a little company"
            maxLength={140}
          />
          <small className="field-error">{errors.title?.message}</small>
        </label>
        {!room && !!similar.data?.results.length && (
          <section className="similar-rooms" aria-label="Similar rooms">
            <h3>There may already be a room for this.</h3>
            <p>
              Join the conversation, or ask the host to collaborate instead of creating a duplicate.
            </p>
            {similar.data.results.map((match) => (
              <div key={match.id} className="panel">
                <Link className="text-link" to={`/rooms/${match.id}`}>
                  {match.title}
                </Link>
                <p className="meta">
                  {match.format} · Hosted by <MemberLink member={match.host} />
                </p>
                {!match.is_owner && <CollaboratorRequest room={match} />}
              </div>
            ))}
            <p className="form-footnote">
              Something different in mind? You can still create your own room below.
            </p>
          </section>
        )}
        {!room && similar.isError && (
          <ErrorNotice error={similar.error} retry={() => void similar.refetch()} />
        )}
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
            <option disabled={room?.format === 'chatroom'} value="conversation">
              Conversation / speaking session
            </option>
            <option disabled={room?.format === 'chatroom'} value="workshop">
              Workshop
            </option>
            <option disabled={room?.format === 'chatroom'} value="panel">
              Panel
            </option>
            <option disabled={room?.format === 'chatroom'} value="coworking">
              Co-working
            </option>
            <option disabled={!!room && room.format !== 'chatroom'} value="chatroom">
              Topic chatroom — ongoing text conversation
            </option>
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
        {chat ? (
          <p className="form-footnote">
            An ongoing in-app chat for a CS topic. Members can join and talk anytime; no schedule or
            external link is required.
          </p>
        ) : (
          <>
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
              Times are entered in {Intl.DateTimeFormat().resolvedOptions().timeZone} and shown in
              each viewer's timezone.
            </p>
          </>
        )}
        <label>
          Virtual meeting link (optional)
          <input type="url" {...form.register('meeting_url')} placeholder="https://…" />
          <small>Only you and active registered attendees can see this link.</small>
          <small className="field-error">{errors.meeting_url?.message}</small>
        </label>
        <label>
          Physical location (optional)
          <input
            {...form.register('physical_location')}
            maxLength={500}
            placeholder="Building, room number, and address"
          />
          <small>
            Add either location or both for a hybrid session. Location details are visible to
            members and approved collaborators.
          </small>
          <small className="field-error">{errors.physical_location?.message}</small>
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
