export function TableSurface(
  { children, caption }: { children: React.ReactNode; caption?: React.ReactNode },
): JSX.Element {
  return (
    <div className="table-surface">
      {caption !== undefined ? <p className="table-surface__caption">{caption}</p> : null}
      <div className="table-surface__scroller">
        {children}
      </div>
    </div>
  );
}
