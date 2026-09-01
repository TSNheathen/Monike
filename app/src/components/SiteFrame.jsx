import { Link, NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { api } from '../lib/pocketbase.js'

export function PublicFrame({ title, children }) {
  return (
    <main className="content-page">
      <Link className="content-logo" to="/" aria-label="Domů Moniké">
        <img src="/assets/landing/small-logo.svg" alt="" />
        <span>Moniké</span>
      </Link>
      <section className="content-panel">
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  )
}

export function AdminFrame({ title, actions, children }) {
  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <Link className="admin-brand" to="/">
          <img src="/assets/landing/small-logo.svg" alt="" />
          <span>Moniké</span>
        </Link>
        <nav aria-label="Administrace">
          <NavLink to="/admin/blog">Blog</NavLink>
          <NavLink to="/admin/gallery">Galerie</NavLink>
          <NavLink to="/admin/login">Přihlášení</NavLink>
        </nav>
        <button type="button" className="ghost-button" onClick={() => api.logout()}>
          <LogOut size={16} aria-hidden="true" />
          Odhlásit
        </button>
      </aside>
      <section className="admin-content">
        <header className="admin-header">
          <h1>{title}</h1>
          {actions}
        </header>
        {children}
      </section>
    </main>
  )
}
