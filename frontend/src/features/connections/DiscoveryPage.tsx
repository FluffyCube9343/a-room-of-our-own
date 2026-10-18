import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Heart,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import { useAction, useApi, useMe } from '../../lib/hooks';
import {
  Avatar,
  BusyLabel,
  ConfirmButton,
  Dialog,
  EmptyState,
  ErrorNotice,
  Pagination,
  Toast,
} from '../../components/ui';
import { ProfileStory, type LikeTarget } from '../profile/ProfileStory';
import { SafetyActions } from '../safety/SafetyActions';
import type { Connection, Message, Page, Profile } from '../../types';

function ConnectionsLoading() {
  return (
    <div className="connection-loading" role="status">
      <span aria-hidden="true" />
      <span className="sr-only">Loading profiles…</span>
    </div>
  );
}
export function ConnectionsPage({ saved = false }: { saved?: boolean }) {
  const [search] = useSearchParams();
  const tab = saved ? 'saved' : search.get('tab') || 'discover';
  const [page, setPage] = useState(1);
  const [like, setLike] = useState<{ profile: Profile; target: LikeTarget } | null>(null);
  const [notice, setNotice] = useState('');
  const action = useAction();
  useEffect(() => {
    setPage(1);
    setNotice('');
  }, [tab]);
  const profiles = useApi<Page<Profile>>(
    saved
      ? `/saved-profiles/?page=${page}`
      : `/discover/?feed=${tab === 'recommended' ? 'recommended' : 'discover'}`,
    tab === 'discover' || tab === 'recommended' || saved,
  );
  const connections = useApi<Page<Connection>>(
    `/connections/?tab=${tab}&page=${page}`,
    ['incoming', 'sent', 'matches'].includes(tab),
  );
  const profile = profiles.data?.results[0];
  const navigate = useNavigate();
  if (!['discover', 'recommended', 'incoming', 'matches', 'sent', 'saved'].includes(tab))
    return (
      <ErrorNotice error={new Error('Unknown connection view. Choose a tab in the navigation.')} />
    );
  return (
    <div className="discovery-page" data-view={tab}>
      <div className="discovery-topline">
        <h1>
          {saved
            ? 'Saved profiles'
            : tab === 'recommended'
              ? 'Recommended'
              : tab === 'incoming'
                ? 'Likes You'
                : tab === 'matches'
                  ? 'Connections'
                  : tab === 'sent'
                    ? 'Sent likes'
                    : 'Discover'}
        </h1>
        <div>
          <Link to="/connections/saved" className="discovery-utility">
            <Bookmark size={15} />
            Saved
          </Link>
          <Link to="/connections?tab=sent" className="discovery-utility">
            <Send size={15} />
            Sent likes
          </Link>
        </div>
      </div>
      <Toast message={notice} />
      <ErrorNotice error={action.error} />
      {tab === 'discover' || tab === 'recommended' || saved ? (
        <>
          {profiles.isPending ? (
            <ConnectionsLoading />
          ) : profiles.isError ? (
            <ErrorNotice error={profiles.error} retry={() => void profiles.refetch()} />
          ) : tab === 'recommended' ? (
            <>
              <p className="recommended-caption">
                People who share your interests or can help with what you want to learn.
              </p>
              <div className="recommended-grid">
                {profiles.data.results.map((person) => (
                  <Link className="recommended-person" to={`/members/${person.id}`} key={person.id}>
                    <div className="recommended-photo">
                      {person.photos[0] ? (
                        <img src={person.photos[0].url} alt={person.display_name} />
                      ) : (
                        <>
                          <Avatar name={person.display_name} large />
                          <span>No photo yet</span>
                        </>
                      )}
                    </div>
                    <div className="recommended-person-copy">
                      <h2>{person.display_name}</h2>
                      <p>{person.role}</p>
                      <span>{person.reasons[0]}</span>
                      <strong>
                        View profile <ArrowRight size={15} />
                      </strong>
                    </div>
                  </Link>
                ))}
              </div>
              {!profiles.data.results.length && (
                <EmptyState title="Your recommendations are taking shape.">
                  <p>Add your interests and learning goals to help us find common ground.</p>
                  <Link className="button secondary" to="/profile/edit">
                    Edit interests
                  </Link>
                </EmptyState>
              )}
            </>
          ) : saved ? (
            <>
              <div className="saved-people">
                {profiles.data.results.map((person) => (
                  <div className="saved-person" key={person.id}>
                    <Link to={`/members/${person.id}`} className="byline">
                      <Avatar name={person.display_name} large />
                      <span>
                        <strong>{person.display_name}</strong>
                        <span className="block">{person.role}</span>
                      </span>
                    </Link>
                    <button
                      className="icon-button"
                      aria-label={`Unsave ${person.display_name}`}
                      disabled={action.isPending}
                      onClick={() =>
                        void action
                          .mutateAsync({ path: `/saved-profiles/${person.id}/`, method: 'DELETE' })
                          .catch(() => {})
                      }
                    >
                      <Bookmark size={18} fill="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
              {!profiles.data.results.length && (
                <EmptyState title="Keep good people close.">
                  Save profiles to revisit them here.
                </EmptyState>
              )}
              {profiles.data.count > 24 && (
                <Pagination page={page} next={profiles.data.next} onChange={setPage} />
              )}
            </>
          ) : profile ? (
            <div className="discovery-stage">
              <div className="discovery-profile" key={profile.id}>
                <ProfileStory profile={profile} onLike={(target) => setLike({ profile, target })} />
                <div className="discover-controls">
                  <button
                    className="pass-button"
                    aria-label={`Pass on ${profile.display_name}`}
                    disabled={action.isPending}
                    onClick={async () => {
                      try {
                        await action.mutateAsync({
                          path: `/discover/passes/${profile.id}/`,
                          method: 'PUT',
                        });
                        window.scrollTo({ top: 0, behavior: 'instant' });
                      } catch {
                        /*shown*/
                      }
                    }}
                  >
                    <X size={27} />
                  </button>
                  <button
                    className="bookmark-button"
                    aria-label={profile.saved ? 'Unsave profile' : 'Save profile'}
                    disabled={action.isPending}
                    onClick={() =>
                      void action
                        .mutateAsync({
                          path: `/saved-profiles/${profile.id}/`,
                          method: profile.saved ? 'DELETE' : 'PUT',
                        })
                        .catch(() => {})
                    }
                  >
                    <Bookmark size={21} fill={profile.saved ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <SafetyActions memberId={profile.id} />
              </div>
            </div>
          ) : (
            <EmptyState title="You're all caught up.">
              <p>New people and new possibilities will find their way here.</p>
              <button
                className="button secondary"
                disabled={action.isPending}
                onClick={() =>
                  void action
                    .mutateAsync({ path: '/discover/passes/', method: 'DELETE' })
                    .catch(() => {})
                }
              >
                Revisit passed profiles
              </button>
              <Link className="text-link" to="/profile/edit">
                Update my interests <ArrowRight size={14} />
              </Link>
            </EmptyState>
          )}
        </>
      ) : connections.isPending ? (
        <ConnectionsLoading />
      ) : connections.isError ? (
        <ErrorNotice error={connections.error} retry={() => void connections.refetch()} />
      ) : (
        <>
          <div className="connection-cards">
            {connections.data.results.map((connection) => (
              <ConnectionCard connection={connection} key={connection.id} />
            ))}
          </div>
          {!connections.data.results.length && (
            <EmptyState
              title={
                tab === 'incoming'
                  ? 'Your next hello is on its way.'
                  : tab === 'matches'
                    ? 'A connection takes two.'
                    : 'Start with something that caught your eye.'
              }
            >
              <p>
                {tab === 'matches'
                  ? 'Accept a like, or send one and wait for a hello back.'
                  : 'A thoughtful profile gives people something to connect with.'}
              </p>
              <Link className="button secondary" to="/profile/studio">
                Make my profile more me
              </Link>
            </EmptyState>
          )}
          {connections.data.count > 24 && (
            <Pagination page={page} next={connections.data.next} onChange={setPage} />
          )}
        </>
      )}
      {like && (
        <LikeComposer
          profile={like.profile}
          target={like.target}
          onClose={() => setLike(null)}
          onSent={(connection) => {
            setLike(null);
            setNotice(
              connection.status === 'accepted'
                ? "It's a connection! You can now say hello."
                : 'Like sent. A little hello goes a long way.',
            );
            if (connection.status === 'accepted') navigate(`/connections/${connection.id}`);
            else window.scrollTo({ top: 0, behavior: 'instant' });
          }}
        />
      )}
    </div>
  );
}
function LikeComposer({
  profile,
  target,
  onClose,
  onSent,
}: {
  profile: Profile;
  target: LikeTarget;
  onClose: () => void;
  onSent: (connection: Connection) => void;
}) {
  const action = useAction<Connection>();
  return (
    <Dialog
      title={`A little hello to ${profile.display_name.split(' ')[0]}.`}
      onClose={() => !action.isPending && onClose()}
    >
      <div className="liked-content">
        <span className="eyebrow">
          YOU LIKED{' '}
          {target.kind === 'photo'
            ? 'A PHOTO'
            : target.kind === 'prompt'
              ? 'THEIR ANSWER'
              : 'THEIR PROFILE'}
        </span>
        {target.url && <img src={target.url} alt={target.label} />}
        <strong>{target.label}</strong>
        {target.text && <p>{target.text}</p>}
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const note = new FormData(event.currentTarget).get('note');
          try {
            const result = await action.mutateAsync({
              path: '/connections/',
              body: {
                member: profile.id,
                target_kind: target.kind,
                prompt_key: target.prompt_key,
                photo: target.photo,
                note,
              },
            });
            onSent(result);
          } catch {
            /*shown*/
          }
        }}
      >
        <label>
          Add a note <span className="optional">(optional)</span>
          <textarea
            name="note"
            rows={3}
            maxLength={500}
            placeholder="What caught your eye?"
            autoFocus
          />
        </label>
        <p className="form-footnote">They can accept your like to open a conversation.</p>
        <ErrorNotice error={action.error} />
        <button className="button full" disabled={action.isPending}>
          <BusyLabel busy={action.isPending}>
            <Heart size={17} />
            Send like
          </BusyLabel>
        </button>
      </form>
    </Dialog>
  );
}
function ConnectionCard({ connection }: { connection: Connection }) {
  const action = useAction();
  const navigate = useNavigate();
  return (
    <article className="panel connection-invite">
      <Link className="invite-person" to={`/members/${connection.member.id}`}>
        {connection.member.photos[0] ? (
          <img src={connection.member.photos[0].url} alt={connection.member.display_name} />
        ) : (
          <Avatar name={connection.member.display_name} large />
        )}
        <div>
          <h3>{connection.member.display_name}</h3>
          <p>{connection.member.role}</p>
        </div>
        <ArrowRight size={17} />
      </Link>
      {connection.status === 'pending' && (
        <>
          <p className="tiny-label">
            {connection.direction === 'incoming' ? 'LIKED YOUR' : 'YOU LIKED THEIR'}{' '}
            {connection.target.kind.toUpperCase()}
          </p>
          <div className="liked-content">
            {connection.target.url && (
              <img src={connection.target.url} alt={connection.target.text || 'Liked photo'} />
            )}
            <strong>{connection.target.label}</strong>
            {connection.target.text && <p>{connection.target.text}</p>}
          </div>
          {connection.note && <blockquote>“{connection.note}”</blockquote>}
        </>
      )}
      <ErrorNotice error={action.error} />
      {connection.status === 'accepted' ? (
        <Link className="button full" to={`/connections/${connection.id}`}>
          <MessageCircle size={17} />
          Say hello
        </Link>
      ) : connection.direction === 'incoming' ? (
        <div className="button-row">
          <button
            className="button secondary"
            disabled={action.isPending}
            onClick={() =>
              void action
                .mutateAsync({
                  path: `/connections/${connection.id}/`,
                  method: 'PATCH',
                  body: { action: 'decline' },
                })
                .catch(() => {})
            }
          >
            <X size={16} />
            Pass
          </button>
          <button
            className="button"
            disabled={action.isPending}
            onClick={async () => {
              try {
                await action.mutateAsync({
                  path: `/connections/${connection.id}/`,
                  method: 'PATCH',
                  body: { action: 'accept' },
                });
                navigate(`/connections/${connection.id}`);
              } catch {
                /*shown*/
              }
            }}
          >
            <Check size={16} />
            Connect
          </button>
        </div>
      ) : (
        <>
          <p className="meta">Your like is with them. Give it a little time.</p>
          <ConfirmButton
            label="Withdraw like"
            title="Withdraw your like?"
            busy={action.isPending}
            onConfirm={() =>
              action.mutateAsync({
                path: `/connections/${connection.id}/`,
                method: 'PATCH',
                body: { action: 'end' },
              })
            }
          >
            This invitation will no longer be available to accept.
          </ConfirmButton>
        </>
      )}
    </article>
  );
}
export function MemberPage() {
  const { id } = useParams();
  const query = useApi<Profile>(`/members/${id}/`);
  const [target, setTarget] = useState<LikeTarget | null>(null);
  const [notice, setNotice] = useState('');
  return (
    <>
      <Link to="/connections" className="back-link">
        <ArrowLeft size={16} />
        Discover people
      </Link>
      <Toast message={notice} />
      <div className="single-mentor">
        {query.isPending ? (
          <ConnectionsLoading />
        ) : query.isError ? (
          <ErrorNotice error={query.error} retry={() => void query.refetch()} />
        ) : (
          <>
            <ProfileStory profile={query.data} onLike={setTarget} />
            <SafetyActions memberId={query.data.id} />
            {target && (
              <LikeComposer
                profile={query.data}
                target={target}
                onClose={() => setTarget(null)}
                onSent={() => {
                  setTarget(null);
                  setNotice('Like sent. Check your Connections tab for replies.');
                }}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
export function ConversationPage() {
  const { id } = useParams();
  const connection = useApi<Connection>(`/connections/${id}/`);
  const [page, setPage] = useState(1);
  const messages = useApi<Page<Message>>(
    `/connections/${id}/messages/?page=${page}`,
    connection.data?.status === 'accepted',
  );
  const { data: me } = useMe();
  const action = useAction();
  const [draft, setDraft] = useState('');
  const navigate = useNavigate();
  if (connection.isPending) return <ConnectionsLoading />;
  if (connection.isError)
    return <ErrorNotice error={connection.error} retry={() => void connection.refetch()} />;
  if (connection.data.status !== 'accepted')
    return (
      <EmptyState title="This conversation isn't open yet.">
        Both people need to connect first.
      </EmptyState>
    );
  return (
    <div className="conversation-page">
      <Link className="back-link" to="/connections?tab=matches">
        <ArrowLeft size={16} />
        Your connections
      </Link>
      <section className="panel">
        <div className="conversation-heading">
          <Avatar name={connection.data.member.display_name} large />
          <div>
            <h2>{connection.data.member.display_name}</h2>
            <Link className="text-link" to={`/members/${connection.data.member.id}`}>
              View profile <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <p className="conversation-intro">
          <Heart size={14} />
          You both chose to connect. Start with a little hello.
        </p>
        <ErrorNotice error={action.error} />
        {messages.isPending ? (
          <ConnectionsLoading />
        ) : messages.isError ? (
          <ErrorNotice error={messages.error} retry={() => void messages.refetch()} />
        ) : (
          <>
            <div className="message-list" aria-live="polite">
              {messages.data.results.map((message) => (
                <div
                  className={`message ${message.sender.id === me?.user?.id ? 'message-mine' : ''}`}
                  key={message.id}
                >
                  <p>{message.body}</p>
                  <time dateTime={message.created_at}>
                    {new Date(message.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              ))}
              {!messages.data.results.length && (
                <p className="empty-conversation">What made their profile stand out to you?</p>
              )}
            </div>
            {messages.data.count > 24 && (
              <Pagination page={page} next={messages.data.next} onChange={setPage} />
            )}
          </>
        )}
        <form
          className="message-compose"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await action.mutateAsync({
                path: `/connections/${id}/messages/`,
                body: { body: draft },
              });
              setDraft('');
              await messages.refetch();
            } catch {
              /*shown*/
            }
          }}
        >
          <label className="sr-only" htmlFor="message">
            Your message
          </label>
          <textarea
            id="message"
            rows={2}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Say something that sounds like you…"
          />
          <button className="button" disabled={!draft.trim() || action.isPending}>
            <Send size={17} />
            <span>Send</span>
          </button>
        </form>
        <button className="text-link" onClick={() => void messages.refetch()}>
          Refresh messages
        </button>
        <div className="conversation-end">
          <ConfirmButton
            className="quiet-button"
            label="End connection"
            title="End this connection?"
            busy={action.isPending}
            onConfirm={async () => {
              await action.mutateAsync({
                path: `/connections/${id}/`,
                method: 'PATCH',
                body: { action: 'end' },
              });
              navigate('/connections?tab=matches');
            }}
          >
            The conversation will close for both of you.
          </ConfirmButton>
          <SafetyActions memberId={connection.data.member.id} />
        </div>
      </section>
    </div>
  );
}
