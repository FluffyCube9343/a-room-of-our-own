import { ArrowUpRight, FileText, Github, Heart, Linkedin, MapPin, Sparkles } from 'lucide-react';
import { Avatar, MemberLink, Tags } from '../../components/ui';
import type { Profile, ProfilePhoto, Prompt } from '../../types';
import { purposeOptions } from './profileOptions';

export interface LikeTarget {
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
        { url: profile.resume_url, label: 'Résumé', Icon: FileText },
        { url: profile.linkedin_url, label: 'LinkedIn', Icon: Linkedin },
        { url: profile.github_url, label: 'GitHub', Icon: Github },
      ]
        .filter((item) => item.url)
        .map(({ url, label, Icon }) => (
          <a href={url} target="_blank" rel="noreferrer" key={label}>
            <Icon size={15} />
            {label}
            <ArrowUpRight size={12} />
          </a>
        ))}
    </div>
  );
}
export function ProfileStory({
  profile,
  onLike,
}: {
  profile: Profile;
  onLike?: (target: LikeTarget) => void;
}) {
  const photos = profile.photos || [];
  const prompts = profile.prompts.filter((p) => p.visible);
  const blocks: ({ kind: 'photo'; value: ProfilePhoto } | { kind: 'prompt'; value: Prompt })[] = [];
  const length = Math.max(photos.length - 1, prompts.length);
  for (let i = 0; i < length; i++) {
    if (prompts[i]) blocks.push({ kind: 'prompt', value: prompts[i] });
    if (photos[i + 1]) blocks.push({ kind: 'photo', value: photos[i + 1] });
  }
  const likeButton = (target: LikeTarget) =>
    onLike && (
      <button
        className="story-like"
        aria-label={`Like ${target.kind === 'photo' ? 'photo' : target.kind === 'prompt' ? 'prompt' : 'profile'}: ${target.label}`}
        onClick={() => onLike(target)}
      >
        <Heart size={22} strokeWidth={1.7} />
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
      {likeButton({
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
          <p>
            {profile.role}
            {profile.pronouns && ` · ${profile.pronouns}`}
          </p>
        </div>
        <div className="profile-purposes">
          {(profile.purposes?.length
            ? profile.purposes
            : profile.intent === 'both'
              ? ['learn', 'mentor']
              : [profile.intent]
          ).map((value) => (
            <span className="intent-badge" key={value}>
              {purposeOptions.find((option) => option.value === value)?.label}
            </span>
          ))}
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
          {likeButton({ kind: 'profile', label: profile.display_name })}
        </div>
      )}
      <section className="story-facts">
        <p className="meta">
          <MapPin size={15} />
          {profile.university}
        </p>
        <Tags ids={profile.interests} />
        {profile.bio && <p>{profile.bio}</p>}
        <ProfessionalLinks profile={profile} />
      </section>
      {profile.reasons.length > 0 && (
        <div className="story-common">
          <Sparkles size={15} />
          {profile.reasons[0]}
        </div>
      )}
      {blocks.map((block) =>
        block.kind === 'photo' ? (
          photoBlock(block.value)
        ) : (
          <section className="story-prompt" key={block.value.key}>
            <p>{block.value.label}</p>
            <h3>{block.value.answer}</h3>
            {likeButton({
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
          <span className="eyebrow">WHAT BRINGS ME HERE</span>
          <p>{profile.goals}</p>
        </section>
      )}
    </article>
  );
}
