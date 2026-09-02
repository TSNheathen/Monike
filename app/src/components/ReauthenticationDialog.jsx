import { useId, useRef, useState } from 'react'
import { Dialog } from './Dialog.jsx'
import { StatusMessage } from './AsyncState.jsx'
import { API_ERROR_KINDS, normalizeApiError } from '../lib/api-errors.js'

export default function ReauthenticationDialog({ open, email = '', authenticate, onSuccess, onCancel }) {
  const passwordRef = useRef(null)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const errorId = useId()

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await authenticate(email, password)
      setPassword('')
      onSuccess()
    } catch (error) {
      const normalized = normalizeApiError(error)
      setMessage(normalized.kind === API_ERROR_KINDS.UNAVAILABLE
        ? normalized.message
        : 'Přihlášení se nepodařilo. Zkontroluj heslo.')
      passwordRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} title="Přihlášení vypršelo" onClose={onCancel} initialFocusRef={passwordRef}>
      <p>Pro pokračování se znovu přihlas. Rozepsané změny zůstanou zachované.</p>
      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>E-mail</span>
          <input type="email" value={email} autoComplete="username" readOnly />
        </label>
        <label className="field">
          <span>Heslo</span>
          <input
            ref={passwordRef}
            type="password"
            value={password}
            autoComplete="current-password"
            required
            aria-invalid={Boolean(message)}
            aria-describedby={message ? errorId : undefined}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <div id={errorId}><StatusMessage kind="error">{message}</StatusMessage></div>
        <div className="dialog-actions">
          <button className="button button--secondary" type="button" onClick={onCancel}>Zrušit</button>
          <button className="button button--primary" type="submit" disabled={busy}>
            {busy ? 'Přihlašuji…' : 'Přihlásit znovu'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
