'use client';

import { useOperator } from './operator-context';
import { StatusBadge } from './status-badge';

export function OperatorSettings(): JSX.Element {
  const { session } = useOperator();

  return (
    <section className="operator-card">
      <div className="operator-card__header">
        <div>
          <p className="panel__label">Authenticated operator</p>
          <p className="operator-card__name">{session.operator.displayName}</p>
        </div>
        <StatusBadge label={session.operator.role} tone={session.operator.role === 'admin' ? 'good' : 'accent'} />
      </div>

      <dl className="operator-card__meta">
        <div>
          <dt>Email</dt>
          <dd>{session.operator.email}</dd>
        </div>
        <div>
          <dt>Session</dt>
          <dd>{session.sessionId}</dd>
        </div>
      </dl>

      <form action="/api/auth/logout" method="post">
        <button className="button button--secondary button--block" type="submit">
          Sign Out
        </button>
      </form>
    </section>
  );
}
