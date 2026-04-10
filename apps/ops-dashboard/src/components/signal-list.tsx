import { StatusBadge } from './status-badge';

export interface SignalListItem {
  id: string;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent';
}

export function SignalList(
  { items }: { items: SignalListItem[] },
): JSX.Element {
  return (
    <div className="signal-list">
      {items.map((item) => (
        <article className="signal-list__item" key={item.id}>
          <div className="signal-list__header">
            <p className="signal-list__label">{item.label}</p>
            {item.tone !== undefined ? (
              <StatusBadge label={typeof item.value === 'string' ? item.value : item.label} tone={item.tone} />
            ) : null}
          </div>
          <div className="signal-list__value">{item.value}</div>
          {item.detail !== undefined ? <p className="signal-list__detail">{item.detail}</p> : null}
        </article>
      ))}
    </div>
  );
}
