export function StatusBadge(
  { label, tone }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' },
): JSX.Element {
  return (
    <span className={`status-badge status-badge--${tone ?? 'neutral'}`}>
      {label}
    </span>
  );
}
