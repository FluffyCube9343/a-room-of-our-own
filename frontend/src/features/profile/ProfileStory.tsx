import { Avatar, MemberLink, Tags } from '../../components/ui';
import type { Profile, ProfilePhoto, Prompt } from '../../types';
import { purposeOptions } from './profileOptions';

export interface ConnectionTarget {
  kind: 'profile' | 'prompt' | 'photo';
  label: string;
  text?: string;
  prompt_key?: string;
  photo?: number;
  url?: string;
}
export function ProfessionalLinks({ profile }: { profile: Profile }) {
  return (
    <div className="professional-links">
      {[
        { url: profile.resume_url, label: 'Résumé' },
        { url: profile.linkedin_url, label: 'LinkedIn' },
        { url: profile.github_url, label: 'GitHub' },
      ]
        .filter((item) => item.url)
        .map(({ url, label }) => (
          <a href={url} target="_blank" rel="noreferrer" key={label}>
            {label}
          </a>
        ))}
    </div>
  );
}
export function ProfileStory({
  profile,
  onConnect,
}: {
  profile: Profile;
  onConnect?: (target: ConnectionTarget) => void;
}) {
  const photos = profile.photos || [];
  const prompts = profile.prompts.filter((p) => p.visible);
  const blocks: ({ kind: 'photo'; value: ProfilePhoto } | { kind: 'prompt'; value: Prompt })[] = [];
  const length = Math.max(photos.length - 1, prompts.length);
  for (let i = 0; i < length; i++) {
    if (prompts[i]) blocks.push({ kind: 'prompt', value: prompts[i] });
    if (photos[i + 1]) blocks.push({ kind: 'photo', value: photos[i + 1] });
  }
  const connectButton = (target: ConnectionTarget) =>
    onConnect && (
      <button
        className="story-connect"
        aria-label={`Connect with ${profile.display_name} about ${target.kind}: ${target.label}`}
        onClick={() => onConnect(target)}
      >
        <span aria-hidden="true">+</span>
      </button>
    );
  const photoBlock = (photo: ProfilePhoto, cover = false) => (
    <div className={`story-photo ${cover ? 'story-cover' : ''}`} key={photo.id}>
      <MemberLink member={profile} className="story-photo-link">
        <img
          src={photo.url}
          alt={photo.caption || `${profile.display_name}'s profile photo`}
          loading={cover ? 'eager' : 'lazy'}
        />
      </MemberLink>
      {photo.caption && <div className="story-caption">{photo.caption}</div>}
      {connectButton({
        kind: 'photo',
        label: photo.caption || 'This photo',
        photo: photo.id,
        url: photo.url,
      })}
    </div>
  );
  return (
    <article className="profile-story">
      <header className="story-heading">
        <div>
          <h2>
            <MemberLink member={profile} />
          </h2>
          <p>{[profile.role, profile.university, profile.pronouns].filter(Boolean).join(' · ')}</p>
        </div>
      </header>
      {photos[0] ? (
        photoBlock(photos[0], true)
      ) : (
        <div className="story-placeholder">
          <MemberLink member={profile}>
            <Avatar name={profile.display_name} large />
          </MemberLink>
          <p>No photos added yet.</p>
          {connectButton({ kind: 'profile', label: profile.display_name })}
        </div>
      )}
      <section className="story-facts">
        {!!profile.purposes?.length && (
          <p className="story-purpose-copy">
            {profile.purposes
              .map((value) => purposeOptions.find((option) => option.value === value)?.label)
              .join(' · ')}
          </p>
        )}
        <Tags ids={profile.interests} />
        {profile.bio && <p>{profile.bio}</p>}
        <ProfessionalLinks profile={profile} />
      </section>
      {blocks.map((block) =>
        block.kind === 'photo' ? (
          photoBlock(block.value)
        ) : (
          <section className="story-prompt" key={block.value.key}>
            <p>{block.value.label}</p>
            <h3>{block.value.answer}</h3>
            {connectButton({
              kind: 'prompt',
              label: block.value.label,
              text: block.value.answer,
              prompt_key: block.value.key,
            })}
          </section>
        ),
      )}
      {!profile.purposes?.length && profile.goals && (
        <section className="story-goals">
          <span className="eyebrow">What brings me here</span>
          <p>{profile.goals}</p>
        </section>
      )}
    </article>
  );
}
