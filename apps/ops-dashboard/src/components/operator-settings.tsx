'use client';

import { useOperator } from './operator-context';

export function OperatorSettings(): JSX.Element {
  const { actorId, setActorId } = useOperator();

  return (
    <section className="panel panel--compact">
      <p className="panel__label">Operator</p>
      <input
        aria-label="Operator ID"
        className="input"
        onChange={(event) => setActorId(event.target.value)}
        placeholder="local-operator"
        value={actorId}
      />
      <p className="panel__hint">Used for dashboard-triggered actions.</p>
    </section>
  );
}
