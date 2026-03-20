export function DefinitionList(
  { items }: { items: Array<{ label: string; value: React.ReactNode }> },
): JSX.Element {
  return (
    <dl className="definition-list">
      {items.map((item) => (
        <div className="definition-list__row" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
