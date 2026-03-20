export function EmptyState(
  { title, message }: { title: string; message: string },
): JSX.Element {
  return (
    <div className="empty-state" role="status">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
