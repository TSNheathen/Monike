import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminFrame } from '../components/SiteFrame.jsx'
import { api } from '../lib/pocketbase.js'
import { API_ERROR_KINDS, normalizeApiError } from '../lib/api-errors.js'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const passwordRef = useRef(null)
  const errorId = useId()

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      await api.login(email, password)
      navigate('/admin/blog')
    } catch (error) {
      const normalized = normalizeApiError(error)
      setMessage(normalized.kind === API_ERROR_KINDS.RATE_LIMITED
        ? 'Proběhlo příliš mnoho pokusů. Počkej prosím minutu a potom to zkus znovu.'
        : 'Přihlášení se nezdařilo. Zkontroluj e-mail a heslo.')
      passwordRef.current?.focus()
    }
  }

  return (
    <AdminFrame title="Přihlášení">
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            autoComplete="username"
            required
            aria-invalid={Boolean(message)}
            aria-describedby={message ? errorId : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Heslo
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
        {message && <p id={errorId} className="status-message status-message--error" role="alert">{message}</p>}
        <button type="submit">Přihlásit</button>
      </form>
    </AdminFrame>
  )
}
