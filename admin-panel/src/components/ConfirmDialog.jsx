export default function ConfirmDialog({ title, message, onConfirm, onCancel, busy = false }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <button type="button" className="button button-muted" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="button button-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : 'Delete'}</button>
        </div>
      </section>
    </div>
  );
}
