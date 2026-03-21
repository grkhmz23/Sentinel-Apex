'use client';

import { useOperator } from './operator-context';

export function OperatorSettings(): JSX.Element {
  const { session } = useOperator();

  return (
    <section className="panel panel--compact">
      <p className="panel__label">Operator</p>
      <p>{session.operator.displayName}</p>
      <p className="panel__hint">{session.operator.email}</p>
      <p className="panel__hint">Role: {session.operator.role}</p>
      <form action="/api/auth/logout" method="post">
        <button className="button button--secondary" type="submit">
          Sign Out
        </button>
      </form>
    </section>
  );
}
