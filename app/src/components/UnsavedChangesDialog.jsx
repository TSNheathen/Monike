import { Dialog } from './Dialog.jsx'

export default function UnsavedChangesDialog({ open, onStay, onDiscard }) {
  return (
    <Dialog open={open} title="Neuložené změny" onClose={onStay}>
      <p>Na stránce jsou neuložené změny. Opravdu je chceš zahodit?</p>
      <div className="dialog-actions">
        <button data-dialog-initial className="button button--secondary" type="button" onClick={onStay}>Zůstat</button>
        <button className="button button--primary" type="button" onClick={onDiscard}>Zahodit změny</button>
      </div>
    </Dialog>
  )
}
