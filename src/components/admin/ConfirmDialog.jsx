import { useEffect, useRef } from 'react';

// Einfacher, freundlicher Bestätigungs-Dialog als Ersatz für das
// technisch wirkende Browser-`confirm()`-Fenster. Wird per <dialog>
// nativ vom Browser gerendert (Fokus-Falle, ESC zum Schliessen gratis).
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Ja, fortfahren',
  cancelLabel = 'Abbrechen',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
    >
      <div className="confirm-dialog__body">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn--outline" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default ConfirmDialog;
