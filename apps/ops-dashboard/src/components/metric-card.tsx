export function MetricCard(
  { label, value, detail, tone = 'neutral' }: {
    label: string;
    value: React.ReactNode;
    detail?: React.ReactNode;
    tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent';
  },
): JSX.Element {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <p className="metric-card__label">{label}</p>
      <div className="metric-card__value">{value}</div>
      {detail !== undefined ? <p className="metric-card__detail">{detail}</p> : null}
    </article>
  );
}
