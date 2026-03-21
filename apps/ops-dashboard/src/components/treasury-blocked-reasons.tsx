import { formatBlockedReasonCategory } from '../lib/treasury-display';

export function TreasuryBlockedReasons(
  { reasons }: {
    reasons: Array<{
      code: string;
      category: string;
      message: string;
      operatorAction: string;
    }>;
  },
): JSX.Element {
  if (reasons.length === 0) {
    return <p className="panel__hint">No active policy or risk blockers.</p>;
  }

  return (
    <div className="reason-list">
      {reasons.map((reason) => (
        <article className="reason-card" key={`${reason.code}-${reason.message}`}>
          <p className="reason-card__eyebrow">{formatBlockedReasonCategory(reason.category)}</p>
          <h3>{reason.message}</h3>
          <p>{reason.operatorAction}</p>
        </article>
      ))}
    </div>
  );
}
