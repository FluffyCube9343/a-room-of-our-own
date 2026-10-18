import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAction, useApi, useMe } from '../../lib/hooks';
import { ApiError } from '../../lib/api';
import {
  Avatar,
  MemberLink,
  BusyLabel,
  ConfirmButton,
  Dialog,
  EmptyState,
  ErrorNotice,
  Pagination,
  Toast,
} from '../../components/ui';
import { ProfileStory, type ConnectionTarget } from '../profile/ProfileStory';
import { SafetyActions } from '../safety/SafetyActions';
import type { Connection, Message, Page, Profile } from '../../types';

function ConnectionsLoading() {
  return (
    <div className="connection-skeleton" role="status" aria-label="Loading profiles">
      <div className="skeleton skeleton-heading" aria-hidden="true" />
      <div className="skeleton skeleton-photo" aria-hidden="true" />
      <div className="skeleton skeleton-line" aria-hidden="true" />
      <div className="skeleton skeleton-line short" aria-hidden="true" />
    </div>
  );
}
export function ConnectionsPage() {
  const [search] = useSearchParams();
  const term = search.get('q') || '';
  const tab = search.get('tab') || 'discover';
  const [page, setPage] = useState(1);
  const [connectionRequest, setConnectionRequest] = useState<{
    profile: Profile;
    target: ConnectionTarget;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const action = useAction();
  useEffect(() => {
    setPage(1);
    setNotice('');
  }, [tab, term]);
  const profiles = useApi<Page<Profile>>(
    `/discover/?feed=${tab === 'recommended' ? 'recommended' : 'discover'}&q=${encodeURIComponent(term)}&page=${page}`,
    tab === 'discover' || tab === 'recommended',
  );
  const connections = useApi<Page<Connection>>(
    `/connections/?tab=${tab}&page=${page}`,
    ['incoming', 'sent', 'matches'].includes(tab),
  );
  const profile = profiles.data?.results[0];
  const navigate = useNavigate();
  if (!['discover', 'recommended', 'incoming', 'matches', 'sent'].includes(tab))
    return (
      <ErrorNotice error={new Error('Unknown connection view. Choose a tab in the navigation.')} />
    );
  return (
    <div className="discovery-page" data-view={tab}>
      <div className="discovery-topline">
        <h1>
          {tab === 'recommended'
            ? 'Recommended'
            : tab === 'incoming'
              ? 'Requests'
              : tab === 'matches'
                ? 'Connections'
                : tab === 'sent'
                  ? 'Sent requests'
                  : 'Discover'}
        </h1>
      </div>
      <Toast message={notice} />
      <ErrorNotice error={action.error} />
      {tab === 'discover' || tab === 'recommended' ? (
        <>
          {profiles.isPending ? (
            <ConnectionsLoading />
          ) : profiles.isError ? (
            <ErrorNotice error={profiles.error} retry={() => void profiles.refetch()} />
          ) : tab === 'recommended' || term.trim() ? (
            <>
              {term.trim() && (
                <p className="recommended-caption" role="status">
                  {profiles.data.count} {profiles.data.count === 1 ? 'person' : 'people'} found
                </p>
              )}
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
                      <strong>View profile</strong>
                    </div>
                  </Link>
                ))}
              </div>
              {profiles.data.count > 24 && (
                <Pagination page={page} next={profiles.data.next} onChange={setPage} />
              )}
              {!profiles.data.results.length && (
                <EmptyState
                  title={term.trim() ? 'No people match this search.' : 'No recommendations yet.'}
                >
                  <p>Add interests to see recommendations.</p>
                  <Link className="button secondary" to="/profile#about">
                    Edit interests
                  </Link>
                </EmptyState>
              )}
            </>
          ) : profile ? (
            <div className="discovery-stage">
              <div className="discovery-profile" key={profile.id}>
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
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
                <ProfileStory
                  profile={profile}
                  onConnect={(target) => setConnectionRequest({ profile, target })}
                />
                <SafetyActions memberId={profile.id} />
              </div>
            </div>
          ) : (
            <EmptyState title="You're all caught up.">
              <button
                className="button secondary"
                disabled={action.isPending}
                onClick={() =>
                  void action
                    .mutateAsync({ path: '/discover/passes/', method: 'DELETE' })
                    .catch(() => {})
                }
              >
                Reset skipped profiles
              </button>
              <Link className="text-link" to="/profile#about">
                Update my interests
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
                  ? 'No connection requests yet.'
                  : tab === 'matches'
                    ? 'No connections yet.'
                    : 'No sent requests yet.'
              }
            >
              <p>
                {tab === 'matches'
                  ? 'Send or accept a connection request to start a conversation.'
                  : 'Find someone in Discover and send them a connection request.'}
              </p>
              <Link className="button secondary" to="/profile#prompts">
                Edit my profile
              </Link>
            </EmptyState>
          )}
          {connections.data.count > 24 && (
            <Pagination page={page} next={connections.data.next} onChange={setPage} />
          )}
        </>
      )}
      {connectionRequest && (
        <ConnectionRequestComposer
          profile={connectionRequest.profile}
          target={connectionRequest.target}
          onClose={() => setConnectionRequest(null)}
          onSent={(connection) => {
            setConnectionRequest(null);
            setNotice(
              connection.status === 'accepted'
                ? "You're connected. You can now send a message."
                : 'Connection request sent.',
            );
            if (connection.status === 'accepted') navigate(`/connections/${connection.id}`);
            else window.scrollTo({ top: 0, behavior: 'instant' });
          }}
        />
      )}
    </div>
  );
}
function ConnectionRequestComposer({
  profile,
  target,
  onClose,
  onSent,
}: {
  profile: Profile;
  target: ConnectionTarget;
  onClose: () => void;
  onSent: (connection: Connection) => void;
}) {
  const action = useAction<Connection>();
  return (
    <Dialog
      title={`Connect with ${profile.display_name.split(' ')[0]}`}
      onClose={() => !action.isPending && onClose()}
    >
      <div className="connection-context">
        <p className="connection-context-label">
          {target.kind === 'photo'
            ? 'About this photo'
            : target.kind === 'prompt'
              ? 'About this answer'
              : 'Connection request'}
        </p>
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
        <p className="form-footnote">A conversation opens when they accept your request.</p>
        <ErrorNotice error={action.error} />
        <button className="button full" disabled={action.isPending}>
          <BusyLabel busy={action.isPending}>Send connection request</BusyLabel>
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
      </Link>
      {connection.status === 'pending' && (
        <>
          <p className="tiny-label">
            {connection.direction === 'incoming' ? 'Request about your' : 'Request about their'}{' '}
            {connection.target.kind === 'prompt' ? 'answer' : connection.target.kind}
          </p>
          <div className="connection-context">
            {connection.target.url && (
              <img src={connection.target.url} alt={connection.target.text || 'Profile photo'} />
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
          Message
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
            Connect
          </button>
        </div>
      ) : (
        <>
          <p className="meta">Connection request pending.</p>
          <ConfirmButton
            label="Withdraw request"
            title="Withdraw this connection request?"
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
  const [target, setTarget] = useState<ConnectionTarget | null>(null);
  const [notice, setNotice] = useState('');
  return (
    <>
      <Link to="/connections" className="back-link">
        <span aria-hidden="true">←</span>
        Discover people
      </Link>
      <Toast message={notice} />
      <div className="single-mentor">
        {query.isPending ? (
          <ConnectionsLoading />
        ) : query.error instanceof ApiError && [403, 404].includes(query.error.status) ? (
          <EmptyState title="This profile isn't available.">
            This member's profile may be private or no longer available to you.
          </EmptyState>
        ) : query.isError ? (
          <ErrorNotice error={query.error} retry={() => void query.refetch()} />
        ) : (
          <>
            <ProfileStory profile={query.data} onConnect={setTarget} />
            <SafetyActions memberId={query.data.id} />
            {target && (
              <ConnectionRequestComposer
                profile={query.data}
                target={target}
                onClose={() => setTarget(null)}
                onSent={() => {
                  setTarget(null);
                  setNotice('Connection request sent. Check Requests for replies.');
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
  const validId = /^\d+$/.test(id || '');
  const connection = useApi<Connection>(`/connections/${id}/`, validId);
  const [page, setPage] = useState(1);
  const messages = useApi<Page<Message>>(
    `/connections/${id}/messages/?page=${page}`,
    validId && connection.data?.status === 'accepted',
  );
  const { data: me } = useMe();
  const action = useAction();
  const [draft, setDraft] = useState('');
  const navigate = useNavigate();
  if (!validId)
    return (
      <EmptyState title="This conversation isn't here.">
        <Link className="text-link" to="/connections?tab=matches">
          Back to connections
        </Link>
      </EmptyState>
    );
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
        <span aria-hidden="true">←</span>
        Your connections
      </Link>
      <section className="panel">
        <div className="conversation-heading">
          <MemberLink member={connection.data.member}>
            <Avatar name={connection.data.member.display_name} large />
          </MemberLink>
          <div>
            <h2>
              <MemberLink member={connection.data.member} />
            </h2>
            <Link className="text-link" to={`/members/${connection.data.member.id}`}>
              View profile
            </Link>
          </div>
        </div>
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
            placeholder="Write a message…"
          />
          <button className="button" disabled={!draft.trim() || action.isPending}>
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
