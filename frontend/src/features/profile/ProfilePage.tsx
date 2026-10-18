import { useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAction, useApi, useMe } from '../../lib/hooks';
import {
  Avatar,
  MemberLink,
  BusyLabel,
  ErrorNotice,
  Loading,
  PageHeader,
  Pagination,
  TagPicker,
  Toast,
  promptLabels,
} from '../../components/ui';
import type { Author, Page, Profile } from '../../types';
import { academicStages, majors, professions, purposeOptions } from './profileOptions';
import { AutosaveStatus, useAutosave } from './useAutosave';

const profileSchema = z
  .object({
    display_name: z.string().trim().min(1, 'Tell us what to call you.').max(80),
    pronouns: z.string().max(40),
    university: z.string().min(1).max(120),
    academic_stage: z.string().min(1, 'Choose your academic stage.'),
    major: z.string(),
    profession: z.string(),
    bio: z.string().max(1200),
    purposes: z.array(z.string()).min(1, 'Choose at least one reason you are here.'),
    interests: z.array(z.number()).min(1, 'Choose at least one interest.'),
    skills: z.array(z.number()),
    learning: z.array(z.number()),
    prompt_key: z.enum(['ask', 'wish', 'learn']),
    prompt_answer: z.string().max(600),
  })
  .superRefine((value, context) => {
    const field = value.academic_stage === 'Post grad' ? 'profession' : 'major';
    if (!value[field])
      context.addIssue({
        code: 'custom',
        path: [field],
        message: field === 'major' ? 'Choose your major.' : 'Choose your role.',
      });
  });
type Values = z.infer<typeof profileSchema>;
export function OnboardingPage() {
  const query = useMe();
  if (!query.data?.user) return <Loading />;
  return <ProfileForm key={query.data.user.id} profile={query.data.user.profile} onboarding />;
}
export function ProfileBasics({ profile }: { profile: Profile }) {
  return <ProfileForm profile={profile} onboarding={false} />;
}
function ProfileForm({ profile, onboarding }: { profile: Profile; onboarding: boolean }) {
  const [step, setStep] = useState(0);
  const action = useAction();
  const navigate = useNavigate();
  const form = useForm<Values>({
    resolver: onboarding ? zodResolver(profileSchema) : undefined,
    defaultValues: {
      ...profile,
      academic_stage: profile.academic_stage || '',
      major: profile.major || '',
      profession: profile.profession || '',
      purposes: profile.purposes?.length
        ? profile.purposes
        : profile.onboarding_complete
          ? profile.intent === 'both'
            ? ['learn', 'mentor']
            : [profile.intent]
          : [],
      prompt_key: 'ask',
      prompt_answer: profile.prompts[0]?.answer || '',
    },
  });
  const errors = form.formState.errors;
  const values = useWatch({ control: form.control }) as Values;
  const editableValues = Object.fromEntries(
    Object.keys(profileSchema.shape)
      .filter((key) => !['prompt_key', 'prompt_answer'].includes(key))
      .map((key) => [key, values[key as keyof Values]]),
  );
  const validation = profileSchema.safeParse(values);
  const changed = Object.keys(editableValues).filter(
    (key) => JSON.stringify(editableValues[key]) !== JSON.stringify(profile[key as keyof Profile]),
  );
  const validationError = validation.success
    ? ''
    : validation.error.issues
        .filter(
          (issue) =>
            changed.includes(String(issue.path[0])) ||
            (changed.includes('academic_stage') &&
              ['major', 'profession'].includes(String(issue.path[0]))),
        )
        .map((issue) => issue.message)
        .join(' ');
  const save = useAutosave({ value: editableValues, validationError, enabled: !onboarding });
  const stage = form.watch('academic_stage');
  const postGrad = stage === 'Post grad';
  const visible = (part: number) => !onboarding || step === part;
  return (
    <div className={onboarding ? 'form-page' : 'profile-basics'}>
      {onboarding && (
        <>
          <Link className="back-link" to="/">
            <ArrowLeft size={16} />
            {onboarding ? 'Back to our story' : 'Your profile'}
          </Link>
          <PageHeader
            title={
              onboarding
                ? ['First, a little about you.', 'What lights you up?', 'What brings you here?'][
                    step
                  ]
                : 'Make yourself known.'
            }
            description={
              onboarding
                ? 'No perfect answers. Just a starting point.'
                : 'The best connections start with being yourself.'
            }
          />
        </>
      )}
      {onboarding && (
        <div className="step-indicator" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((n) => (
            <span className={n <= step ? 'active' : ''} key={n} />
          ))}
        </div>
      )}
      <form
        className={onboarding ? 'panel profile-form' : 'profile-basics-form'}
        onBlurCapture={() => {
          if (!onboarding) save.flush();
        }}
        onSubmit={
          onboarding
            ? form.handleSubmit(async (values) => {
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
                    body: {
                      ...rest,
                      ...(onboarding ? { prompts } : {}),
                      onboarding_complete: true,
                    },
                  });
                  navigate('/home');
                } catch {
                  /* displayed below */
                }
              })
            : (event) => {
                event.preventDefault();
                save.flush();
              }
        }
      >
        {visible(0) && (
          <>
            <div className="form-two">
              <label>
                <span>Your name</span>
                <input {...form.register('display_name')} autoComplete="name" />
                <small className="field-error">{errors.display_name?.message}</small>
              </label>
              <label>
                <span>
                  Pronouns <span className="optional">(optional)</span>
                </span>
                <input {...form.register('pronouns')} placeholder="e.g. she/her" />
              </label>
            </div>
            <div className="form-two">
              <label>
                <span>Academic stage</span>
                <select
                  aria-label="Academic stage"
                  {...form.register('academic_stage')}
                  onChange={(event) => {
                    form.setValue('academic_stage', event.target.value, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                    form.setValue(event.target.value === 'Post grad' ? 'major' : 'profession', '', {
                      shouldDirty: true,
                    });
                  }}
                >
                  <option value="">Choose your stage</option>
                  {academicStages.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <small className="field-error">{errors.academic_stage?.message}</small>
              </label>
              <label>
                <span>{postGrad ? 'Technical / academic role' : 'Major or field of study'}</span>
                {postGrad ? (
                  <select aria-label="Technical / academic role" {...form.register('profession')}>
                    <option value="">Choose your role</option>
                    {professions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    aria-label="Major or field of study"
                    {...form.register('major')}
                    disabled={!stage}
                  >
                    <option value="">Choose your major</option>
                    {majors.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
                <small className="field-error">
                  {postGrad ? errors.profession?.message : errors.major?.message}
                </small>
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
              <span>
                A little about you <span className="optional">(optional)</span>
              </span>
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
          <details className="profile-more-details" open={onboarding}>
            <summary hidden={onboarding}>Interests and skills</summary>
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
          </details>
        )}
        {visible(2) && (
          <details className="profile-more-details" open={onboarding}>
            <summary hidden={onboarding}>What brings you here</summary>
            <Controller
              name="purposes"
              control={form.control}
              render={({ field }) => (
                <fieldset className="purpose-picker">
                  <legend>I'm here to?</legend>
                  <p className="meta">Choose all that sound like you.</p>
                  <div className="purpose-grid">
                    {purposeOptions.map((option) => (
                      <label
                        className={`purpose-option ${field.value.includes(option.value) ? 'selected' : ''}`}
                        key={option.value}
                      >
                        <input
                          type="checkbox"
                          checked={field.value.includes(option.value)}
                          onChange={(event) =>
                            field.onChange(
                              event.target.checked
                                ? [...field.value, option.value]
                                : field.value.filter((value) => value !== option.value),
                            )
                          }
                        />
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <small className="field-error">{errors.purposes?.message}</small>
                </fieldset>
              )}
            />
            {onboarding ? (
              <>
                <label>
                  <span>
                    Pick a prompt <span className="optional">(optional)</span>
                  </span>
                  <select {...form.register('prompt_key')}>
                    {Object.entries(promptLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
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
          </details>
        )}
        <ErrorNotice error={action.error} />
        {!onboarding && <AutosaveStatus save={save} />}
        {Object.keys(errors).length > 0 && (
          <p className="field-error" role="alert">
            Please check the highlighted fields before continuing.
          </p>
        )}
        {onboarding && (
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
                      step === 0
                        ? [
                            'display_name',
                            'academic_stage',
                            postGrad ? 'profession' : 'major',
                            'university',
                          ]
                        : ['interests'],
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
                  Open my door
                  <ArrowRight size={16} />
                </BusyLabel>
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
export function ProfileSettings() {
  const { data: me } = useMe();
  const [page, setPage] = useState(1);
  const blocks = useApi<Page<Author>>(`/blocks/?page=${page}`);
  const action = useAction();
  const [message, setMessage] = useState('');
  const client = useQueryClient();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState<Error | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  if (!me?.user) return <Loading />;
  return (
    <div className="settings-panel">
      <section className="settings-section" aria-label="Account">
        <AccountEmail email={me.user.email} />
      </section>
      <section className="settings-section settings-reset">
        <div>
          <h2>Skipped profiles</h2>
          <p>See people you skipped in Discover again.</p>
        </div>
        <button
          className="button secondary small"
          disabled={action.isPending}
          onClick={async () => {
            setMessage('');
            try {
              await action.mutateAsync({ path: '/discover/passes/', method: 'DELETE' });
              setMessage('Skipped profiles reset. They can appear in Discover again.');
            } catch {
              /* action.error is displayed below. */
            }
          }}
        >
          Reset skipped profiles
        </button>
      </section>
      <section className="settings-section settings-visibility" aria-label="Profile visibility">
        <div>
          <h2>Show me in Discover</h2>
          <p>Let other members find and connect with you.</p>
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            role="switch"
            aria-label="Show me in Discover"
            checked={me.user.profile.discoverable}
            disabled={action.isPending}
            onChange={async (event) => {
              try {
                await action.mutateAsync({
                  path: '/profile/',
                  method: 'PATCH',
                  body: { discoverable: event.target.checked },
                });
                setMessage('Visibility updated.');
              } catch {
                /* action.error is shown below. */
              }
            }}
          />
          <span aria-hidden="true" />
        </label>
      </section>
      <details className="settings-blocks">
        <summary>
          <span>Blocked people</span>
          <small>
            {blocks.isPending ? 'Loading…' : blocks.isError ? 'Unavailable' : blocks.data.count}
          </small>
        </summary>
        <p className="settings-help">
          Unblocking allows contact again. Previous activity stays removed.
        </p>
        {blocks.isPending ? (
          <Loading />
        ) : (
          blocks.data && (
            <>
              {blocks.data.results.length ? (
                blocks.data.results.map((member) => (
                  <div className="member-row" key={member.id}>
                    <span className="byline">
                      <MemberLink member={member}>
                        <Avatar name={member.display_name} />
                      </MemberLink>
                      <MemberLink member={member} />
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
                          /* action.error is shown below. */
                        }
                      }}
                    >
                      Unblock
                    </button>
                  </div>
                ))
              ) : (
                <p className="settings-help">No blocked people.</p>
              )}
              {blocks.data.count > 24 && (
                <Pagination page={page} next={blocks.data.next} onChange={setPage} />
              )}
            </>
          )
        )}
      </details>
      {blocks.isError && <ErrorNotice error={blocks.error} retry={() => void blocks.refetch()} />}
      <ErrorNotice error={action.error || logoutError} />
      <Toast message={message} />
      <button
        className="settings-signout"
        disabled={loggingOut}
        onClick={async () => {
          setLoggingOut(true);
          setLogoutError(null);
          try {
            await api('/auth/logout/', 'POST');
            client.clear();
            navigate('/');
          } catch (error) {
            setLogoutError(error as Error);
          } finally {
            setLoggingOut(false);
          }
        }}
      >
        <LogOut size={17} />
        <BusyLabel busy={loggingOut}>Sign out</BusyLabel>
      </button>
    </div>
  );
}

function AccountEmail({ email: initialEmail }: { email: string }) {
  const [email, setEmail] = useState(initialEmail);
  const validation = z.email('Enter a valid email address.').safeParse(email.trim());
  const save = useAutosave({
    value: { email: email.trim().toLowerCase() },
    path: '/account/',
    validationError: validation.success ? '' : 'Enter a valid email address.',
  });
  return (
    <form
      onBlurCapture={() => save.flush()}
      onSubmit={(event) => {
        event.preventDefault();
        save.flush();
      }}
    >
      <label>
        Email address
        <input
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <AutosaveStatus save={save} />
    </form>
  );
}
