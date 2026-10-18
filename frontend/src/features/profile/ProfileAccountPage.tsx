import { type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ErrorNotice, Loading } from '../../components/ui';
import { useMe } from '../../lib/hooks';
import { ProfileBasics, ProfileSettings } from './ProfilePage';
import { PhotoEditor, ProfessionalLinksEditor, PromptEditor } from './ProfileStudio';
import { ProfileStory } from './ProfileStory';

const sections = ['about', 'prompts', 'settings'] as const;
type Section = (typeof sections)[number];
export function ProfileAccountPage() {
  const query = useMe();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const requested = hash.slice(1);
  const active = requested === 'closed' ? null : requested || 'about';
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  if (!query.data.user) return <ErrorNotice error={new Error('Sign in to edit your profile.')} />;
  if (requested && requested !== 'closed' && !sections.includes(requested as Section))
    return (
      <ErrorNotice
        error={new Error('Unknown profile section. Choose Profile to return to your editor.')}
      />
    );
  const profile = query.data.user.profile;
  const section = (id: Section, title: string, content: ReactNode) => (
    <section className="profile-account-section" id={id}>
      <h2 className="profile-section-heading">
        <button
          id={`profile-${id}-toggle`}
          type="button"
          aria-expanded={active === id}
          aria-controls={`profile-${id}-content`}
          onClick={() => {
            navigate(`/profile#${active === id ? 'closed' : id}`, {
              replace: true,
              preventScrollReset: true,
            });
          }}
        >
          {title}
          <span className="profile-section-symbol" aria-hidden="true">
            {active === id ? '−' : '+'}
          </span>
        </button>
      </h2>
      <div
        className="profile-section-content"
        id={`profile-${id}-content`}
        role="region"
        aria-labelledby={`profile-${id}-toggle`}
        aria-hidden={active !== id}
        inert={active !== id}
        data-open={active === id}
      >
        <div className="profile-section-clip">
          <div className="profile-section-body">{content}</div>
        </div>
      </div>
    </section>
  );
  return (
    <div className="profile-account-page">
      <header className="profile-account-heading">
        <div>
          <h1>Edit profile</h1>
        </div>
        <Link className="button secondary small" to="/profile/preview">
          View profile
        </Link>
      </header>
      <PhotoEditor photos={profile.photos} />
      {section(
        'about',
        'Basic info',
        <>
          <ProfileBasics profile={profile} />
          <details className="profile-more-details">
            <summary>Professional links</summary>
            <ProfessionalLinksEditor profile={profile} />
          </details>
        </>,
      )}
      {section('prompts', 'Prompts', <PromptEditor profile={profile} />)}
      {section('settings', 'Account settings', <ProfileSettings />)}
    </div>
  );
}

export function ProfilePreviewPage() {
  const query = useMe();
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  if (!query.data.user) return <ErrorNotice error={new Error('Sign in to view your profile.')} />;
  return (
    <div className="profile-preview-page">
      <Link className="back-link" to="/profile">
        Edit profile
      </Link>
      <ProfileStory profile={query.data.user.profile} />
    </div>
  );
}
