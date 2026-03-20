import { formatJson } from '../lib/format';

export function JsonBlock(
  { value }: { value: Record<string, unknown> },
): JSX.Element {
  return (
    <pre className="json-block">
      <code>{formatJson(value)}</code>
    </pre>
  );
}
