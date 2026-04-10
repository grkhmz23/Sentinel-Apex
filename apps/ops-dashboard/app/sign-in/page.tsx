import Image from 'next/image';

import { DeploymentTruthBanner } from '../../src/components/deployment-truth-banner';
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
    <main className="signin-shell">
      <div className="signin-shell__backdrop" aria-hidden="true" />

      <section className="signin-shell__hero">
        <Image
          alt="Sentinel Apex"
          className="signin-shell__logo"
          height={86}
          priority
          src="/logo.png"
          width={300}
        />
        <h1>Operator access for protocol truth, not a marketing demo.</h1>
        <p className="signin-shell__summary">
          This Vercel-hosted console exposes allocator, carry, treasury, venue, reconciliation, and mismatch
          workflows while keeping execution truth, long-running runtime control, and venue-native evidence
          ingestion on the backend.
        </p>

        <div className="signin-shell__chips" aria-label="Current execution scope">
          <span className="truth-chip truth-chip--accent">Jupiter devnet</span>
          <span className="truth-chip truth-chip--accent">Carry sleeve only</span>
          <span className="truth-chip truth-chip--accent">USDC base asset</span>
          <span className="truth-chip">Operator approval</span>
          <span className="truth-chip">Evidence-backed execution</span>
          <span className="truth-chip truth-chip--danger">Devnet demo only</span>
        </div>

        <DeploymentTruthBanner />
      </section>

      <section className="panel auth-panel">
        <div className="page__header">
          <div>
            <p className="eyebrow">Secure Session</p>
            <h2>Ops dashboard sign in</h2>
            <p className="panel__subtitle">
              Session-backed operator access with backend-signed proxy requests. Frontend secrets stay server-side.
            </p>
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
          <button className="button" type="submit">Initialize Session</button>
        </form>

        {errorMessage !== null ? <p className="feedback feedback--error">{errorMessage}</p> : null}

        <div className="auth-panel__notes">
          <p className="panel__hint">
            Use the bootstrap operator script for local development. Production claims remain blocked; this deploy
            stays explicitly demo and staging scoped.
          </p>
          <p className="panel__hint">
            Hackathon eligibility rules remain enforced: USDC base asset, 3-month rolling tenor, target APY floor
            of at least 10%, and disallowed yield sources blocked.
          </p>
        </div>
      </section>
    </main>
  );
}
