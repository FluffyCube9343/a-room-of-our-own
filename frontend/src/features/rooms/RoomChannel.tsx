import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Hash, Reply, Pencil, Send, X, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi, useMe } from '../../lib/hooks';
import {
  Avatar,
  MemberLink,
  ConfirmButton,
  ErrorNotice,
  Loading,
  Pagination,
  Tags,
} from '../../components/ui';
import type { Author, Message, Page, Room } from '../../types';

type ChatMessage = Message & {
  edited_at: string | null;
  deleted_at: string | null;
  reply: { id: number; sender: Author; body: string } | null;
};

export function RoomChannel({ room }: { room: Room }) {
  const { data: me } = useMe();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const loaded = useRef<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [older, setOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [unread, setUnread] = useState(false);
  const [memberPage, setMemberPage] = useState(1);
  const members = useApi<Page<Author>>(`/rooms/${room.id}/members/?page=${memberPage}`);
  const scroll = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const initialized = useRef(false);
  const action = useAction();
  const path = `/rooms/${room.id}/messages/`;
  const messages = useQuery({
    queryKey: ['room-channel', room.id],
    gcTime: 0,
    retry: false,
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const existing = loaded.current;
      const newest = existing.at(-1)?.id;
      const fresh = await api<Page<ChatMessage>>(`${path}${newest ? `?after=${newest}` : ''}`);
      const synced: ChatMessage[] = [];
      for (let i = 0; i < existing.length; i += 100) {
        const result = await api<{ results: ChatMessage[] }>(
          `${path}?ids=${existing
            .slice(i, i + 100)
            .map((m) => m.id)
            .join(',')}`,
        );
        synced.push(...result.results);
      }
      return { fresh, synced, ids: existing.map((m) => m.id) };
    },
  });
  useEffect(() => {
    if (!messages.data) return;
    const { fresh, synced, ids } = messages.data;
    if (!initialized.current) {
      setOlder(!!fresh.next);
      initialized.current = true;
    }
    const hasNew = fresh.results.some((m) => m.id > (loaded.current.at(-1)?.id || 0));
    setHistory((current) => {
      const next = [
        ...new Map(
          [...current.filter((m) => !ids.includes(m.id)), ...synced, ...fresh.results].map((m) => [
            m.id,
            m,
          ]),
        ).values(),
      ].sort((a, b) => a.id - b.id);
      loaded.current = next;
      return next;
    });
    if (hasNew && atBottom.current)
      requestAnimationFrame(() => {
        if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
      });
    else if (hasNew) setUnread(true);
  }, [messages.data]);
  const send = async () => {
    if (!draft.trim() || action.isPending) return;
    try {
      atBottom.current = true;
      await action.mutateAsync({
        path,
        body: { body: draft.trim(), reply_to_id: reply?.id ?? null },
      });
      setDraft('');
      setReply(null);
      composer.current?.focus();
    } catch {
      /* Preserve the draft for retry. */
    }
  };
  return (
    <section className="room-channel">
      <header className="channel-header">
        <Hash size={24} />
        <div>
          <h1>{room.title}</h1>
          <p>One room. An ongoing conversation.</p>
        </div>
        <span className="meta">
          <Users size={16} /> {members.data?.count ?? room.attendee_count}
        </span>
      </header>
      <div className="channel-layout">
        <div className="channel-conversation">
          <ErrorNotice error={messages.error} retry={() => void messages.refetch()} />
          {messages.isPending && <Loading />}
          <div
            className="channel-history"
            ref={scroll}
            role="log"
            aria-label="Room messages"
            onScroll={() => {
              const node = scroll.current!;
              atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 70;
              if (atBottom.current) setUnread(false);
            }}
          >
            {older && (
              <button
                className="text-link"
                disabled={loadingOlder}
                onClick={async () => {
                  setLoadingOlder(true);
                  setError(null);
                  const node = scroll.current;
                  const height = node?.scrollHeight || 0;
                  const top = node?.scrollTop || 0;
                  try {
                    const result = await api<Page<ChatMessage>>(
                      `${path}?before=${loaded.current[0].id}`,
                    );
                    setHistory((current) => {
                      const next = [
                        ...new Map([...result.results, ...current].map((m) => [m.id, m])).values(),
                      ].sort((a, b) => a.id - b.id);
                      loaded.current = next;
                      return next;
                    });
                    setOlder(!!result.next);
                    requestAnimationFrame(() => {
                      if (node) node.scrollTop = top + node.scrollHeight - height;
                    });
                  } catch (e) {
                    setError(e as Error);
                  } finally {
                    setLoadingOlder(false);
                  }
                }}
              >
                {loadingOlder ? 'Loading…' : 'Load earlier messages'}
              </button>
            )}
            {!history.length && !messages.isPending && (
              <div className="channel-welcome">
                <Hash size={36} />
                <h2>Welcome to {room.title}</h2>
                <p>
                  This is the beginning of your conversation. Share a question, an idea, or a quick
                  hello.
                </p>
              </div>
            )}
            {history.map((message, index) => {
              const previous = history[index - 1];
              const date = new Date(message.created_at).toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              });
              const day =
                !previous ||
                new Date(previous.created_at).toDateString() !==
                  new Date(message.created_at).toDateString();
              const grouped =
                !day &&
                previous.sender.id === message.sender.id &&
                !message.reply &&
                !previous.deleted_at &&
                +new Date(message.created_at) - +new Date(previous.created_at) < 300000;
              const mine = message.sender.id === me?.user?.id;
              return (
                <div key={message.id} id={`message-${message.id}`}>
                  {day && <div className="channel-date">{date}</div>}
                  <article className={`channel-message ${grouped ? 'grouped' : ''}`}>
                    <div className="channel-avatar">
                      {!grouped && (
                        <MemberLink member={message.sender}>
                          <Avatar name={message.sender.display_name} />
                        </MemberLink>
                      )}
                    </div>
                    <div className="channel-message-content">
                      {!grouped && (
                        <div className="channel-author">
                          <strong>
                            <MemberLink member={message.sender} />
                          </strong>
                          {message.sender.id === room.host.id && (
                            <span className="channel-host">Host</span>
                          )}
                          <time
                            dateTime={message.created_at}
                            title={new Date(message.created_at).toLocaleString()}
                          >
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                      )}
                      {message.reply && !message.deleted_at && (
                        <blockquote className="channel-reply">
                          <Reply size={13} />
                          <strong>
                            <MemberLink member={message.reply.sender} />
                          </strong>{' '}
                          {message.reply.body}
                        </blockquote>
                      )}
                      {editing === message.id ? (
                        <form
                          className="channel-edit"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                              await action.mutateAsync({
                                path: `${path}${message.id}/`,
                                method: 'PATCH',
                                body: { body: editBody },
                              });
                              setEditing(null);
                            } catch {
                              /* shown below */
                            }
                          }}
                        >
                          <textarea
                            aria-label="Edit message"
                            value={editBody}
                            maxLength={2000}
                            onChange={(e) => setEditBody(e.target.value)}
                          />
                          <button
                            className="button"
                            disabled={!editBody.trim() || action.isPending}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <p className={message.deleted_at ? 'meta' : ''}>
                          {message.deleted_at ? 'Message deleted' : message.body}
                          {message.edited_at && !message.deleted_at && (
                            <small className="meta"> (edited)</small>
                          )}
                        </p>
                      )}
                    </div>
                    {!message.deleted_at && (
                      <div className="channel-actions">
                        <button
                          title="Reply"
                          aria-label={`Reply to ${message.sender.display_name}`}
                          onClick={() => {
                            setReply(message);
                            composer.current?.focus();
                          }}
                        >
                          <Reply size={15} />
                        </button>
                        {mine && (
                          <button
                            title="Edit message"
                            aria-label="Edit message"
                            onClick={() => {
                              setEditing(message.id);
                              setEditBody(message.body);
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {(mine || room.is_owner) && (
                          <ConfirmButton
                            label="Delete"
                            title="Delete this message?"
                            busy={action.isPending}
                            onConfirm={() =>
                              action.mutateAsync({
                                path: `${path}${message.id}/`,
                                method: 'DELETE',
                              })
                            }
                          >
                            This message will be removed from the conversation.
                          </ConfirmButton>
                        )}
                      </div>
                    )}
                  </article>
                </div>
              );
            })}
          </div>
          {unread && (
            <button
              className="channel-unread"
              onClick={() => {
                if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
                atBottom.current = true;
                setUnread(false);
              }}
            >
              New messages ↓
            </button>
          )}
          <div className="channel-compose-wrap">
            {reply && (
              <div className="channel-replying">
                Replying to{' '}
                <strong>
                  <MemberLink member={reply.sender} />
                </strong>
                <button aria-label="Cancel reply" onClick={() => setReply(null)}>
                  <X size={16} />
                </button>
              </div>
            )}
            <form
              className="channel-compose"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <textarea
                ref={composer}
                aria-label="Message the room"
                placeholder={`Message # ${room.title}`}
                value={draft}
                rows={2}
                maxLength={2000}
                disabled={action.isPending}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button
                className="button"
                title="Send message"
                aria-label="Send message"
                disabled={!draft.trim() || action.isPending || messages.isError}
              >
                <Send size={18} />
              </button>
            </form>
            <div className="channel-compose-note">
              <span>Enter to send · Shift + Enter for a new line</span>
              <span>{draft.length}/2000</span>
            </div>
            <ErrorNotice error={action.error || error} />
          </div>
        </div>
        <aside className="channel-sidebar">
          {room.cover_url && <img className="channel-cover" src={room.cover_url} alt="" />}
          <h3>About this room</h3>
          <p className="preserve-lines">{room.description}</p>
          <Tags ids={room.tags} />
          <h3>Members {members.data ? `· ${members.data.count}` : ''}</h3>
          <ErrorNotice error={members.error} />
          {members.data?.results.map((member) => (
            <div className="channel-member" key={member.id}>
              <MemberLink member={member}>
                <Avatar name={member.display_name} />
              </MemberLink>
              <div>
                <strong>
                  <MemberLink member={member} />
                </strong>
                <span className="meta">{member.id === room.host.id ? 'Host' : member.role}</span>
              </div>
            </div>
          ))}
          {members.data && (members.data.next || memberPage > 1) && (
            <Pagination page={memberPage} next={members.data.next} onChange={setMemberPage} />
          )}
        </aside>
      </div>
    </section>
  );
}
