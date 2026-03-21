import { getDefaultSignInEmail } from '../../src/lib/env.server';

export const dynamic = 'force-dynamic';

function resolveErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case 'invalid_credentials':
      return 'Invalid email or password.';
    case 'session_required':
      return 'Sign in to access the ops dashboard.';
    default:
      return null;
  }
}

export default function SignInPage(
  { searchParams }: { searchParams?: { error?: string; next?: string } },
): JSX.Element {
  const nextPath = searchParams?.next?.startsWith('/') === true ? searchParams.next : '/';
  const errorMessage = resolveErrorMessage(searchParams?.error);

  return (
    <main className="page page--auth">
      <section className="panel auth-panel">
        <div className="page__header">
          <div>
            <p className="eyebrow">Sentinel Apex</p>
            <h1>Ops Dashboard Sign In</h1>
          </div>
        </div>
        <form action="/api/auth/login" className="auth-form" method="post">
          <input name="next" type="hidden" value={nextPath} />
          <label className="field">
            <span>Email</span>
            <input
              autoComplete="username"
              className="input"
              defaultValue={getDefaultSignInEmail()}
              name="email"
              required
              type="email"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              className="input"
              name="password"
              required
              type="password"
            />
          </label>
          <button className="button" type="submit">Sign In</button>
        </form>
        {errorMessage !== null ? <p className="feedback feedback--error">{errorMessage}</p> : null}
        <p className="panel__hint">
          Use the bootstrap script to create an internal operator account for local development.
        </p>
      </section>
    </main>
  );
}
