export function Panel(
  { children, title, subtitle, compact = false }: {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    compact?: boolean;
  },
): JSX.Element {
  return (
    <section className={`panel${compact ? ' panel--compact' : ''}`}>
      <div className="panel__header">
        <div>
          <h2>{title}</h2>
          {subtitle !== undefined ? <p className="panel__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
