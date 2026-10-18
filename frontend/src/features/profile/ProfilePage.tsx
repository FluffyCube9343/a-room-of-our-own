import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, LogOut, Pencil, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAction, useApi, useMe } from '../../lib/hooks';
import {
  Avatar,
  BusyLabel,
  EmptyState,
  ErrorNotice,
  Loading,
  PageHeader,
  Pagination,
  TagPicker,
  Tags,
  Toast,
  promptLabels,
} from '../../components/ui';
import type { Author, Page, Profile } from '../../types';
import { ProfileStory } from './ProfileStory';

const profileSchema = z.object({
  display_name: z.string().trim().min(1, 'Tell us what to call you.').max(80),
  pronouns: z.string().max(40),
  university: z.string().min(1).max(120),
  role: z.string().trim().min(1, 'Add your academic year or role.').max(120),
  bio: z.string().max(1200),
  goals: z.string().trim().min(1, 'Tell us what you hope to find.').max(1000),
  intent: z.enum(['learn', 'mentor', 'both']),
  interests: z.array(z.number()).min(1, 'Choose at least one interest.'),
  skills: z.array(z.number()),
  learning: z.array(z.number()),
  prompt_key: z.enum(['ask', 'wish', 'learn']),
  prompt_answer: z.string().max(600),
});
type Values = z.infer<typeof profileSchema>;
export function ProfileEditor({ onboarding = false }: { onboarding?: boolean }) {
  const query = useMe();
  if (!query.data?.user) return <Loading />;
  return (
    <ProfileForm
      key={query.data.user.id}
      profile={query.data.user.profile}
      onboarding={onboarding}
    />
  );
}
function ProfileForm({ profile, onboarding }: { profile: Profile; onboarding: boolean }) {
  const [step, setStep] = useState(0);
  const action = useAction();
  const navigate = useNavigate();
  const form = useForm<Values>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      ...profile,
      prompt_key: 'ask',
      prompt_answer: profile.prompts[0]?.answer || '',
    },
  });
  const errors = form.formState.errors;
  const visible = (part: number) => !onboarding || step === part;
  return (
    <div className="form-page">
      <Link className="back-link" to={onboarding ? '/' : '/profile'}>
        <ArrowLeft size={16} />
        {onboarding ? 'Back to our story' : 'Your profile'}
      </Link>
      <PageHeader
        eyebrow={
          onboarding ? `A LITTLE INTRODUCTION · ${step + 1} OF 3` : 'YOUR STORY, IN YOUR WORDS'
        }
        title={
          onboarding
            ? ['First, a little about you.', 'What lights you up?', 'What brings you here?'][step]
            : 'Make yourself known.'
        }
        description={
          onboarding
            ? 'No perfect answers. Just a starting point.'
            : 'The best connections start with being yourself.'
        }
      />
      {onboarding && (
        <div className="step-indicator" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((n) => (
            <span className={n <= step ? 'active' : ''} key={n} />
          ))}
        </div>
      )}
      <form
        className="panel profile-form"
        onSubmit={form.handleSubmit(async (values) => {
          const { prompt_key, prompt_answer, ...rest } = values;
          const prompts = onboarding
            ? prompt_answer.trim()
              ? [{ key: prompt_key, answer: prompt_answer.trim(), order: 0 }]
              : []
            : undefined;
          try {
            await action.mutateAsync({
              path: '/profile/',
              method: 'PATCH',
              body: { ...rest, ...(onboarding ? { prompts } : {}), onboarding_complete: true },
            });
            navigate(onboarding ? '/home' : '/profile');
          } catch {
            /* displayed below */
          }
        })}
      >
        {visible(0) && (
          <>
            <label>
              Your name
              <input {...form.register('display_name')} autoComplete="name" />
              {errors.display_name && (
                <small className="field-error">{errors.display_name.message}</small>
              )}
            </label>
            <div className="form-two">
              <label>
                Pronouns <span className="optional">(optional)</span>
                <input {...form.register('pronouns')} placeholder="e.g. she/her" />
              </label>
              <label>
                Academic year or role
                <input
                  {...form.register('role')}
                  placeholder="e.g. First-year · Computer science"
                />
                {errors.role && <small className="field-error">{errors.role.message}</small>}
              </label>
            </div>
            <label>
              University or community
              <input {...form.register('university')} />
              {errors.university && (
                <small className="field-error">{errors.university.message}</small>
              )}
            </label>
            <label>
              A little about you <span className="optional">(optional)</span>
              <textarea
                {...form.register('bio')}
                rows={3}
                placeholder="What should your people know about you?"
                maxLength={1200}
              />
            </label>
          </>
        )}
        {visible(1) && (
          <>
            <Controller
              name="interests"
              control={form.control}
              render={({ field }) => (
                <TagPicker
                  label="I'm interested in…"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.interests?.message}
                />
              )}
            />
            <Controller
              name="skills"
              control={form.control}
              render={({ field }) => (
                <TagPicker
                  label="I can share a little about…"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="learning"
              control={form.control}
              render={({ field }) => (
                <TagPicker
                  label="I'd love to learn…"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </>
        )}
        {visible(2) && (
          <>
            <label>
              I'm here to…
              <select {...form.register('intent')}>
                <option value="learn">Find a mentor</option>
                <option value="mentor">Be a mentor</option>
                <option value="both">A little of both</option>
              </select>
            </label>
            <label>
              What are you hoping to find?
              <textarea
                {...form.register('goals')}
                rows={3}
                placeholder="A mentor, the courage to start, a team for an idea…"
                maxLength={1000}
              />
              {errors.goals && <small className="field-error">{errors.goals.message}</small>}
            </label>
            {onboarding ? (
              <>
                <label>
                  Pick a prompt <span className="optional">(optional)</span>
                  <select {...form.register('prompt_key')}>
                    {Object.entries(promptLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <Link className="button secondary" to="/profile/studio">
                Customize prompts, photos & links
              </Link>
            )}
            {onboarding && (
              <label>
                Your answer
                <textarea
                  {...form.register('prompt_answer')}
                  maxLength={600}
                  rows={3}
                  placeholder="A small story says a lot."
                />
              </label>
            )}
          </>
        )}
        <ErrorNotice error={action.error} />
        {Object.keys(errors).length > 0 && (
          <p className="field-error" role="alert">
            Please check the highlighted fields before continuing.
          </p>
        )}
        <div className="button-row">
          {onboarding && step > 0 && (
            <button type="button" className="button secondary" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} />
              Back
            </button>
          )}
          {onboarding && step < 2 ? (
            <button
              type="button"
              className="button push-right"
              onClick={async () => {
                if (
                  await form.trigger(
                    step === 0 ? ['display_name', 'role', 'university'] : ['interests'],
                  )
                )
                  setStep(step + 1);
              }}
            >
              Keep going <ArrowRight size={17} />
            </button>
          ) : (
            <button className="button push-right" disabled={action.isPending}>
              <BusyLabel busy={action.isPending}>
                {onboarding ? 'Open my door' : 'Save my profile'}
                <ArrowRight size={16} />
              </BusyLabel>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
export function ProfilePage() {
  const { data } = useMe();
  if (!data?.user) return <Loading />;
  const profile = data.user.profile;
  return (
    <>
      <PageHeader
        eyebrow="YOUR PLACE IN THE ROOM"
        title="A little more you."
        action={
          <div className="button-row">
            <Link className="button secondary" to="/settings">
              <Settings size={16} />
              Settings
            </Link>
            <Link className="button" to="/profile/edit">
              <Pencil size={16} />
              Edit basics
            </Link>
            <Link className="button secondary" to="/profile/studio">
              Prompts & photos
            </Link>
          </div>
        }
      />
      <div className="profile-layout">
        <section className="panel profile-summary">
          <Avatar name={profile.display_name} large />
          <h2>{profile.display_name}</h2>
          <p>
            {profile.role}
            {profile.pronouns && ` · ${profile.pronouns}`}
          </p>
          <p>{profile.university}</p>
          <Tags ids={profile.interests} />
          <p>{profile.bio}</p>
          <span className="tag">
            {profile.discoverable ? 'Visible in discovery' : 'Hidden from discovery'}
          </span>
        </section>
        <div>
          <p className="eyebrow">YOUR PROFILE PREVIEW · ONLY SHOWING PROMPTS APPEAR HERE</p>
          <ProfileStory profile={profile} />
          <div className="button-row">
            <Link to="/connections/saved" className="button secondary">
              Saved profiles
            </Link>
            <Link to="/rooms?mine=1" className="button secondary">
              My rooms
            </Link>
            <Link to="/projects?mine=1" className="button secondary">
              My projects
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
export function SettingsPage() {
  const { data: me } = useMe();
  const [page, setPage] = useState(1);
  const blocks = useApi<Page<Author>>(`/blocks/?page=${page}`);
  const action = useAction();
  const [message, setMessage] = useState('');
  const client = useQueryClient();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState<Error | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  return (
    <div className="form-page">
      <PageHeader eyebrow="YOUR SPACE, YOUR CHOICE" title="A little peace of mind." />
      <section className="panel">
        <h2>Profile visibility</h2>
        <p>
          Choose whether other members can find your profile. Your name still appears on rooms and
          projects you create.
        </p>
        <label className="switch-label">
          <input
            type="checkbox"
            checked={me?.user?.profile.discoverable || false}
            disabled={action.isPending}
            onChange={async (event) => {
              try {
                await action.mutateAsync({
                  path: '/profile/',
                  method: 'PATCH',
                  body: { discoverable: event.target.checked },
                });
                setMessage('Your visibility preference is saved.');
              } catch {
                /* shown below */
              }
            }}
          />
          Show my profile in discovery
        </label>
      </section>
      <section className="panel">
        <h2>Blocked members</h2>
        <p>
          Unblocking restores visibility. It doesn't restore previous RSVPs, saves, or project
          requests.
        </p>
        {blocks.isPending ? (
          <Loading />
        ) : blocks.isError ? (
          <ErrorNotice error={blocks.error} retry={() => void blocks.refetch()} />
        ) : (
          <>
            {blocks.data.results.length ? (
              blocks.data.results.map((member) => (
                <div className="member-row" key={member.id}>
                  <span className="byline">
                    <Avatar name={member.display_name} />
                    {member.display_name}
                  </span>
                  <button
                    className="button secondary small"
                    disabled={action.isPending}
                    onClick={async () => {
                      try {
                        await action.mutateAsync({
                          path: `/blocks/${member.id}/`,
                          method: 'DELETE',
                        });
                        setMessage('Member unblocked.');
                      } catch {
                        /* shown below */
                      }
                    }}
                  >
                    Unblock
                  </button>
                </div>
              ))
            ) : (
              <EmptyState title="No blocked members." />
            )}
            {blocks.data.count > 24 && (
              <Pagination page={page} next={blocks.data.next} onChange={setPage} />
            )}
          </>
        )}
      </section>
      <ErrorNotice error={action.error || logoutError} />
      <Toast message={message} />
      <button
        className="button secondary"
        disabled={loggingOut}
        onClick={async () => {
          setLoggingOut(true);
          try {
            await api('/auth/logout/', 'POST');
            client.clear();
            navigate('/');
          } catch (err) {
            setLogoutError(err as Error);
          } finally {
            setLoggingOut(false);
          }
        }}
      >
        <LogOut size={16} />
        <BusyLabel busy={loggingOut}>Sign out</BusyLabel>
      </button>
    </div>
  );
}
