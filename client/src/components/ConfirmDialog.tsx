import { useEffect, useRef, type ReactNode } from 'react';

export function ConfirmDialog({
  children,
  title,
  message,
  busy,
  error,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  children?: ReactNode;
  title: string;
  message: string;
  busy: boolean;
  error: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className="confirm-dialog"
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <p>{message}</p>
      {children}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="secondary-button" disabled={busy} onClick={onClose} autoFocus>
          Cancel
        </button>
        <button className="primary-button" disabled={busy} onClick={onConfirm}>
          {busy ? 'Saving…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
