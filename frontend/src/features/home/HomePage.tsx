import { ArrowRight, Plus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi, useMe } from '../../lib/hooks';
import {
  CommunityNote,
  EmptyState,
  ErrorNotice,
  Loading,
  MentorPreview,
  PageHeader,
  ProjectCard,
  RoomCard,
  SectionHeading,
} from '../../components/ui';
import type { HomeData } from '../../types';

export function HomePage() {
  const { data: me } = useMe();
  const query = useApi<HomeData>('/home/');
  return (
    <>
      <PageHeader
        eyebrow="YOUR LITTLE CORNER OF THE COMMUNITY"
        title={`You're in good company, ${me?.user?.profile.display_name.split(' ')[0] || 'friend'}.`}
        description="A new conversation. A shared idea. Something good starts here."
        action={
          <Link className="button secondary" to="/rooms/new">
            <Plus size={17} />
            Host a room
          </Link>
        }
      />
      <section className="welcome-banner">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} />
            MAKE YOURSELF AT HOME
          </span>
          <h2>
            You don't have to do
            <br />
            <em>the next thing alone.</em>
          </h2>
          <p>Find someone to learn from. Or someone to learn with.</p>
          <Link className="text-link" to="/connections">
            Meet your people <ArrowRight size={16} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="banner-door" />
          <span>✳</span>
          <div className="banner-step" />
        </div>
      </section>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <section className="content-section">
            <SectionHeading title="Rooms you might like" to="/rooms" />
            <div className="card-grid">
              {query.data.rooms.map((room, index) => (
                <RoomCard room={room} index={index} key={room.id} />
              ))}
            </div>
            {!query.data.rooms.length && (
              <EmptyState>
                <Link to="/rooms/new" className="text-link">
                  Host the first room <ArrowRight size={16} />
                </Link>
              </EmptyState>
            )}
          </section>
          <section className="content-section">
            <SectionHeading title="People to learn with" to="/connections" />
            <div className="people-grid">
              {query.data.mentors.map((profile) => (
                <MentorPreview profile={profile} key={profile.id} />
              ))}
            </div>
            {!query.data.mentors.length && <EmptyState title="Your people are on their way." />}
          </section>
          <section className="content-section">
            <SectionHeading title="Projects looking for you" to="/projects" />
            <div className="card-grid">
              {query.data.projects.map((project) => (
                <ProjectCard project={project} key={project.id} />
              ))}
            </div>
            {!query.data.projects.length && <EmptyState />}
          </section>
        </>
      )}
      <CommunityNote />
    </>
  );
}
