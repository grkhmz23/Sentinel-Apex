export function Panel(
  { children, title, subtitle, compact = false, action }: {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    compact?: boolean;
    action?: React.ReactNode;
  },
): JSX.Element {
  return (
    <section className={`panel${compact ? ' panel--compact' : ''}`}>
      <div className="panel__header">
        <div>
          <h2>{title}</h2>
          {subtitle !== undefined ? <p className="panel__subtitle">{subtitle}</p> : null}
        </div>
        {action !== undefined ? <div className="panel__header-action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
