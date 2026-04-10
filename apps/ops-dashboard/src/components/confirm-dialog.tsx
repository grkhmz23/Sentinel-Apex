'use client';

export function ConfirmDialog(
  {
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = 'Cancel',
    busy = false,
    tone = 'accent',
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    busy?: boolean;
    tone?: 'accent' | 'warn' | 'bad';
    onConfirm: () => void;
    onCancel: () => void;
  },
): JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        aria-describedby="confirm-dialog-description"
        aria-modal="true"
        className={`confirm-dialog confirm-dialog--${tone}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="confirm-dialog__header">
          <p className="eyebrow">Confirm Action</p>
          <h2>{title}</h2>
        </div>
        <p className="confirm-dialog__description" id="confirm-dialog-description">{description}</p>
        <div className="confirm-dialog__actions">
          <button className="button button--secondary" disabled={busy} onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button className="button" disabled={busy} onClick={onConfirm} type="button">
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
