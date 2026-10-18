import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAction, useMe } from '../../lib/hooks';
import { BusyLabel, ErrorNotice, Logo } from '../../components/ui';

const schema = z.object({
  display_name: z.string().max(80).optional(),
  email: z.email('Enter a valid email.'),
  password: z.string().min(1, 'Enter your password.').max(128),
});
type Values = z.infer<typeof schema>;
export function AuthPage({ signup = false }: { signup?: boolean }) {
  const { data } = useMe();
  const navigate = useNavigate();
  const action = useAction<{ onboarding_complete: boolean }>();
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  if (data?.user)
    return (
      <Navigate to={data.user.profile.onboarding_complete ? '/home' : '/onboarding'} replace />
    );
  return (
    <div className="auth-page community-site">
      <header>
        <Link to="/">
          <Logo />
        </Link>
      </header>
      <main className="auth-layout auth-layout-simple">
        <section className="form-card">
          <h1>{signup ? 'Create an account' : 'Sign in'}</h1>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              if (signup && !values.display_name?.trim()) {
                form.setError('display_name', { message: 'Enter your name.' });
                return;
              }
              try {
                const result = await action.mutateAsync({
                  path: `/auth/${signup ? 'signup' : 'login'}/`,
                  body: values,
                });
                navigate(result.onboarding_complete ? '/home' : '/onboarding');
              } catch {
                /* displayed below */
              }
            })}
          >
            {signup && (
              <label>
                Your name
                <input autoComplete="name" {...form.register('display_name')} required />
                {form.formState.errors.display_name && (
                  <small className="field-error">
                    {form.formState.errors.display_name.message}
                  </small>
                )}
              </label>
            )}
            <label>
              Email address
              <input type="email" autoComplete="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <small className="field-error">{form.formState.errors.email.message}</small>
              )}
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                {...form.register('password')}
              />
              {signup && <small>At least 8 characters.</small>}
              {form.formState.errors.password && (
                <small className="field-error">{form.formState.errors.password.message}</small>
              )}
            </label>
            <ErrorNotice error={action.error} />
            <button className="button full" disabled={action.isPending}>
              <BusyLabel busy={action.isPending}>{signup ? 'Create account' : 'Sign in'}</BusyLabel>
            </button>
          </form>
          <p className="auth-switch">
            {signup ? 'Already have an account?' : 'New to the community?'}{' '}
            <Link to={signup ? '/login' : '/signup'}>
              {signup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <nav className="auth-policies" aria-label="Community information">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
          </nav>
        </section>
      </main>
    </div>
  );
}
