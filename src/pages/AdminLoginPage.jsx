import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminFrame } from '../components/SiteFrame.jsx'
import { api } from '../lib/pocketbase.js'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      await api.login(email, password)
      navigate('/admin/blog')
    } catch {
      setMessage('Přihlášení se nezdařilo. Zkontroluj e-mail a heslo.')
    }
  }

  return (
    <AdminFrame title="Přihlášení">
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          E-mail
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Heslo
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {message && <p role="alert">{message}</p>}
        <button type="submit">Přihlásit</button>
      </form>
    </AdminFrame>
  )
}
