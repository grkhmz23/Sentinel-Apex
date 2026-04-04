export function StatusBadge(
  { label, tone }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' },
): JSX.Element {
  return (
    <span className={`status-badge status-badge--${tone ?? 'neutral'}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
