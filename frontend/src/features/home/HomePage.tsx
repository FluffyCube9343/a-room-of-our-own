import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Camera, DoorOpen, Link2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi, useMe } from '../../lib/hooks';
import { Avatar, MemberLink, Dialog, EmptyState, ErrorNotice, Loading } from '../../components/ui';
import type { Author, HomeData, Profile, Project, Prompt, Room } from '../../types';
import './communityBoard.css';

type PhotoPin = {
  kind: 'photo';
  id: string;
  src: string;
  title: string;
  caption: string;
  author: Author | null;
  source: 'member' | 'campus';
  alt: string;
  credit: string | null;
  objectPosition?: string;
  href: string;
};
type NotePin = { kind: 'note'; id: string; profile: Profile; prompt: Prompt; href: string };
type RoomPin = { kind: 'room'; id: string; room: Room };
type ProjectPin = { kind: 'project'; id: string; project: Project };
type Pin = PhotoPin | NotePin | RoomPin | ProjectPin;
type Story = { photos: PhotoPin[]; index: number };

const campusPhotos: PhotoPin[] = [
  {
    kind: 'photo',
    id: 'uva-friends',
    src: '/board/uva-friends-on-grounds.jpg',
    title: 'Between classes',
    caption: 'A little time together on Grounds.',
    alt: 'Three UVA students walking together beneath colorful autumn trees on Grounds.',
    credit: 'Lathan Goumas / University Communications',
    objectPosition: '18% center',
    author: null,
    source: 'campus',
    href: 'https://news.virginia.edu/content/photos-breathtaking-look-falls-beauty-across-grounds',
  },
  {
    kind: 'photo',
    id: 'uva-spring',
    src: '/board/uva-spring-on-the-lawn.jpg',
    title: 'An afternoon outside',
    caption: 'Study breaks at the amphitheater.',
    alt: 'UVA students reading, studying, and relaxing on the amphitheater steps in the sunshine.',
    credit: 'Emily Faith Morgan / University Communications',
    objectPosition: '42% center',
    author: null,
    source: 'campus',
    href: 'https://news.virginia.edu/content/spring-has-sprung-grounds',
  },
  {
    kind: 'photo',
    id: 'uva-rotunda',
    src: '/board/uva-rotunda-in-bloom.jpg',
    title: 'Grounds in bloom',
    caption: 'Spring at the Rotunda.',
    alt: 'The UVA Rotunda and white flowering trees against a clear blue spring sky.',
    credit: 'Julia Weaver / University Communications',
    objectPosition: '30% center',
    author: null,
    source: 'campus',
    href: 'https://news.virginia.edu/content/spring-has-sprung-grounds',
  },
];
const rotations = [-3, 1.8, -1.5, 2.5, -2, 3, 1, -2.5];
const roomDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const roomTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function makePins(data: HomeData, viewer: Profile) {
  const profiles = [viewer, ...data.mentors.filter((profile) => profile.id !== viewer.id)];
  const photos: PhotoPin[] = profiles.flatMap((profile) =>
    profile.photos.map((photo) => ({
      kind: 'photo' as const,
      id: `photo-${photo.id}`,
      src: photo.url,
      title: profile.display_name,
      caption: photo.caption,
      author: profile,
      source: 'member' as const,
      alt: `Photo shared by ${profile.display_name}${photo.caption ? `: ${photo.caption}` : ''}`,
      credit: null,
      href: profile.id === viewer.id ? '/profile' : `/members/${profile.id}`,
    })),
  );
  photos.push(...campusPhotos);
  const notes: NotePin[] = profiles.flatMap((profile) =>
    profile.prompts
      .filter((prompt) => prompt.visible && prompt.answer.trim())
      .map((prompt) => ({
        kind: 'note' as const,
        id: `note-${profile.id}-${prompt.key}`,
        profile,
        prompt,
        href: profile.id === viewer.id ? '/profile' : `/members/${profile.id}`,
      })),
  );
  const rooms: RoomPin[] = data.rooms.map((room) => ({
    kind: 'room',
    id: `room-${room.id}`,
    room,
  }));
  const projects: ProjectPin[] = data.projects.map((project) => ({
    kind: 'project',
    id: `project-${project.id}`,
    project,
  }));
  const streams: Pin[][] = [photos, notes, rooms, projects];
  const pins: Pin[] = [];
  for (let i = 0; i < Math.max(...streams.map((stream) => stream.length)); i++) {
    for (const stream of streams) if (stream[i]) pins.push(stream[i]);
  }
  return { pins, photos };
}

function PinHead() {
  return <span className="board-pushpin" aria-hidden="true" />;
}

function BoardAvatar({ member }: { member: Author }) {
  return member.avatar_url ? (
    <img className="board-avatar" src={member.avatar_url} alt="" />
  ) : (
    <Avatar name={member.display_name} photoUrl={member.avatar_url} />
  );
}

function PhotoImage({ photo, eager = false }: { photo: PhotoPin; eager?: boolean }) {
  const [error, setError] = useState(false);
  if (error)
    return (
      <div className="board-image-error" role="alert">
        <Camera size={22} />
        <span>This photo could not load.</span>
      </div>
    );
  return (
    <img
      src={photo.src}
      alt={photo.alt}
      loading={eager ? 'eager' : 'lazy'}
      style={photo.objectPosition ? { objectPosition: photo.objectPosition } : undefined}
      onError={() => setError(true)}
    />
  );
}

function BoardPin({
  pin,
  index,
  onPhoto,
}: {
  pin: Pin;
  index: number;
  onPhoto: (pin: PhotoPin) => void;
}) {
  const paper = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const node = paper.current;
    if (!node || !node.parentElement)
      throw new Error('A board pin must be mounted inside its paper grid.');
    const measure = () => {
      const rowHeight = parseFloat(getComputedStyle(node.parentElement!).gridAutoRows);
      if (!Number.isFinite(rowHeight) || rowHeight <= 0)
        throw new Error('The board grid needs a positive row height.');
      const spacing = getComputedStyle(node);
      const height =
        node.offsetHeight + parseFloat(spacing.marginTop) + parseFloat(spacing.marginBottom);
      node.style.gridRowEnd = `span ${Math.ceil(height / rowHeight)}`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const style = { '--pin-rotation': `${rotations[index % rotations.length]}deg` } as CSSProperties;
  if (pin.kind === 'photo')
    return (
      <article ref={paper} className="board-pin board-polaroid" style={style} data-kind="photo">
        <span className="board-tape" aria-hidden="true" />
        {pin.author ? (
          <MemberLink member={pin.author} className="board-photo-button">
            <div className="board-photo-image">
              <PhotoImage photo={pin} eager={index < 8} />
            </div>
            <div className="board-photo-caption">
              <span className="board-byline">
                <BoardAvatar member={pin.author} />
                <span>{pin.author.display_name}</span>
              </span>
            </div>
          </MemberLink>
        ) : (
          <button
            className="board-photo-button"
            onClick={() => onPhoto(pin)}
            aria-label={`Open polaroid: ${pin.title}`}
          >
            <div className="board-photo-image">
              <PhotoImage photo={pin} eager={index < 8} />
            </div>
            <div className="board-photo-caption">
              <span className="board-byline">{pin.credit}</span>
            </div>
          </button>
        )}
      </article>
    );
  if (pin.kind === 'note')
    return (
      <article
        ref={paper}
        className={`board-pin board-note ${index % 3 === 0 ? 'board-note-ink' : ''}`}
        style={style}
        data-kind="note"
      >
        <PinHead />
        <Link
          to={pin.href}
          className="board-pin-link"
          aria-label={`Read ${pin.profile.display_name}'s note: ${pin.prompt.label}`}
        >
          <p className="board-note-prompt">{pin.prompt.label}</p>
          <h2>{pin.prompt.answer}</h2>
          <span className="board-byline">
            <BoardAvatar member={pin.profile} />
            <span>{pin.profile.display_name}</span>
          </span>
        </Link>
      </article>
    );
  if (pin.kind === 'room') {
    const date = pin.room.starts_at ? new Date(pin.room.starts_at) : null;
    return (
      <article ref={paper} className="board-pin board-room" style={style} data-kind="room">
        <PinHead />
        <div className="board-pin-link">
          <Link
            to={`/rooms/${pin.room.id}`}
            aria-label={`Open room: ${pin.room.title}`}
            className="board-content-link"
          >
            {pin.room.cover_url && (
              <img className="board-cover" src={pin.room.cover_url} alt="" loading="lazy" />
            )}
            <h2>{pin.room.title}</h2>
            <p className="board-room-time">
              <time dateTime={pin.room.starts_at || undefined}>
                {date
                  ? `${roomDate.format(date)} · ${roomTime.format(date)}`
                  : 'Ongoing topic chatroom'}
              </time>
            </p>
            <span className="board-room-rule" aria-hidden="true" />
          </Link>
          <MemberLink member={pin.room.host} className="board-byline">
            <BoardAvatar member={pin.room.host} />
            <span>{pin.room.host.display_name}</span>
          </MemberLink>
        </div>
      </article>
    );
  }
  return (
    <article ref={paper} className="board-pin board-project" style={style} data-kind="project">
      <span className="board-paperclip" aria-hidden="true" />
      <div className="board-pin-link">
        <Link
          to={`/projects/${pin.project.id}`}
          aria-label={`Open project: ${pin.project.title}`}
          className="board-content-link"
        >
          {pin.project.cover_url && (
            <img className="board-cover" src={pin.project.cover_url} alt="" loading="lazy" />
          )}
          <h2>{pin.project.title}</h2>
          <p>{pin.project.description}</p>
        </Link>
        <MemberLink member={pin.project.owner} className="board-byline">
          <BoardAvatar member={pin.project.owner} />
          <span>{pin.project.owner.display_name}</span>
        </MemberLink>
      </div>
    </article>
  );
}

function PhotoStory({ story, onClose }: { story: Story; onClose: () => void }) {
  const [index, setIndex] = useState(story.index);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((value) => Math.min(value + 1, story.photos.length - 1));
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((value) => Math.max(value - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [story.photos.length]);
  const photo = story.photos[index];
  if (!photo) throw new Error('The selected board photo is missing from this story.');
  return (
    <Dialog title={photo.title} onClose={onClose}>
      <div className="board-story">
        <div
          className="board-story-progress"
          aria-label={`Photo ${index + 1} of ${story.photos.length}`}
        >
          {story.photos.map((item, i) => (
            <span key={item.id} data-current={i === index} />
          ))}
        </div>
        <div className="board-story-image">
          {photo.author ? (
            <MemberLink member={photo.author}>
              <PhotoImage key={photo.id} photo={photo} eager />
            </MemberLink>
          ) : (
            <PhotoImage key={photo.id} photo={photo} eager />
          )}
        </div>
        {photo.caption && <p>{photo.caption}</p>}
        {photo.credit && <p className="board-photo-credit">Photo: {photo.credit}</p>}
        <div className="board-story-actions">
          <button
            className="icon-button"
            aria-label="Previous photo"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            <ArrowLeft size={20} />
          </button>
          {photo.author ? (
            <Link className="text-link" to={photo.href}>
              {photo.href === '/profile' ? 'Visit your story' : 'Visit their story'}{' '}
              <ArrowUpRight size={15} />
            </Link>
          ) : (
            <a className="text-link" href={photo.href} target="_blank" rel="noreferrer">
              Photo source <ArrowUpRight size={15} />
            </a>
          )}
          <button
            className="icon-button"
            aria-label="Next photo"
            disabled={index === story.photos.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function SharePin({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="A little something to share?" onClose={onClose}>
      <div className="board-share-options">
        <Link to="/profile#prompts">
          <Camera size={22} />
          <span>
            <strong>A photo or a thought</strong>
            <small>Add to your photo story or share an answer.</small>
          </span>
          <ArrowUpRight size={18} />
        </Link>
        <Link to="/rooms/new">
          <DoorOpen size={22} />
          <span>
            <strong>An open invitation</strong>
            <small>Make room for a conversation or activity.</small>
          </span>
          <ArrowUpRight size={18} />
        </Link>
        <Link to="/projects/new">
          <Link2 size={22} />
          <span>
            <strong>An idea to build together</strong>
            <small>Find a few people to bring it to life.</small>
          </span>
          <ArrowUpRight size={18} />
        </Link>
      </div>
    </Dialog>
  );
}

function Pinboard({ data }: { data: HomeData }) {
  const { data: me } = useMe();
  const [story, setStory] = useState<Story | null>(null);
  const [sharing, setSharing] = useState(false);
  if (!me?.user) throw new Error('The community board requires a signed-in profile.');
  const { pins, photos } = makePins(data, me.user.profile);
  const openPhoto = (photo: PhotoPin) => {
    const index = photos.findIndex((item) => item.id === photo.id);
    if (index < 0) throw new Error('This polaroid is missing from the board photo collection.');
    setStory({ photos, index });
  };
  return (
    <>
      <header className="board-heading">
        <button className="button" onClick={() => setSharing(true)}>
          <Plus size={17} />
          Pin something
        </button>
      </header>
      <h1 className="sr-only">Community board</h1>
      <section className="community-board" aria-label="Community board">
        <div className="board-wall">
          {pins.map((pin) => (
            <BoardPin key={pin.id} pin={pin} index={pins.indexOf(pin)} onPhoto={openPhoto} />
          ))}
        </div>
        {pins.length === 0 && (
          <EmptyState title="A little space for something new.">
            <button className="text-link" onClick={() => setSharing(true)}>
              Pin the first one <Plus size={16} />
            </button>
          </EmptyState>
        )}
      </section>
      <nav className="board-explore" aria-label="Explore the community">
        <Link to="/rooms">
          Find a room <ArrowUpRight size={15} />
        </Link>
        <Link to="/connections">
          Meet your people <ArrowUpRight size={15} />
        </Link>
        <Link to="/projects">
          Build something <ArrowUpRight size={15} />
        </Link>
      </nav>
      {sharing && <SharePin onClose={() => setSharing(false)} />}
      {story && <PhotoStory story={story} onClose={() => setStory(null)} />}
    </>
  );
}

export function HomePage() {
  const query = useApi<HomeData>('/home/');
  return (
    <div className="board-page">
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : (
        <Pinboard data={query.data} />
      )}
    </div>
  );
}
