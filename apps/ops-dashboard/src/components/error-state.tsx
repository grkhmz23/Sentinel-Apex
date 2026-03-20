export function ErrorState(
  { title, message }: { title: string; message: string },
): JSX.Element {
  return (
    <div className="error-state" role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
