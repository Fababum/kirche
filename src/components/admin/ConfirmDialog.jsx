import { useEffect, useId, useRef, useState } from 'react';

// Einfacher, freundlicher Bestätigungs-Dialog als Ersatz für das
// technisch wirkende Browser-`confirm()`-Fenster. Wird per <dialog>
// nativ vom Browser gerendert. Während einer Anfrage bleibt er geöffnet.
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
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId();
  const messageId = useId();

  function cancel() {
    if (busy.current) return;
    setError('');
    onCancel();
  }

  async function confirm() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(`Die Aktion konnte nicht abgeschlossen werden. Bitte prüfen Sie die Verbindung und versuchen Sie es erneut. ${err.message || ''}`);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

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
      aria-labelledby={titleId}
      aria-describedby={messageId}
      aria-busy={pending}
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) cancel();
      }}
    >
      <div className="confirm-dialog__body">
        <h3 id={titleId}>{title}</h3>
        <p id={messageId}>{message}</p>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn--outline" onClick={cancel} disabled={pending} autoFocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={confirm}
            disabled={pending}
          >
            {pending ? 'Wird ausgeführt …' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default ConfirmDialog;
