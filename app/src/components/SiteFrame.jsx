import { useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ExternalLink, LogOut, Menu, X } from 'lucide-react'
import { navItems } from '../data/landing.js'
import { api } from '../lib/pocketbase.js'
import { useRouteFocus } from '../hooks/useRouteFocus.js'
import ModalDrawer from './ModalDrawer.jsx'

function SkipLink() {
  return <a className="skip-link" href="#main-content">Přeskočit na hlavní obsah</a>
}

function useDrawer() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  return { open, setOpen, triggerRef }
}

function PublicNavigation({ mobile = false, close }) {
  const location = useLocation()
  return (
    <nav className={mobile ? 'public-drawer__nav' : 'public-nav'} aria-label="Hlavní navigace">
      {navItems.map((item) => {
        const [pathname, query = ''] = item.href.split('?')
        const active = location.pathname === pathname && (!query || location.search === `?${query}`)
        return (
          <Link
            key={item.label}
            className={active ? 'active' : undefined}
            aria-current={active ? 'page' : undefined}
            to={item.href}
            onClick={close}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function PublicFrame({ title, children }) {
  const headingRef = useRouteFocus()
  const drawer = useDrawer()

  return (
    <div className="public-shell">
      <SkipLink />
      <header className="public-header">
        <Link className="content-logo" to="/" aria-label="Domů Moniké">
          <img src="/assets/landing/small-logo.svg" alt="" />
          <span>Moniké</span>
        </Link>
        <PublicNavigation />
        <button
          ref={drawer.triggerRef}
          className="icon-button public-menu-trigger"
          type="button"
          aria-label="Otevřít hlavní menu"
          aria-controls="public-navigation-drawer"
          aria-expanded={drawer.open}
          onClick={() => drawer.setOpen(true)}
        >
          <Menu aria-hidden="true" />
        </button>
      </header>
      {drawer.open && (
        <ModalDrawer
          open={drawer.open}
          id="public-navigation-drawer"
          label="Hlavní menu"
          triggerRef={drawer.triggerRef}
          onClose={() => drawer.setOpen(false)}
        >
          <div className="public-drawer">
            <button
              className="icon-button public-drawer__close"
              type="button"
              aria-label="Zavřít hlavní menu"
              onClick={() => drawer.setOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
            <PublicNavigation mobile close={() => drawer.setOpen(false)} />
          </div>
        </ModalDrawer>
      )}
      <main id="main-content" className="content-page" tabIndex="-1">
        <section className="content-panel">
          <h1 ref={headingRef} tabIndex="-1">{title}</h1>
          {children}
        </section>
      </main>
    </div>
  )
}

function AdminNavigation({ close }) {
  return (
    <nav className="admin-nav" aria-label="Hlavní navigace administrace">
      <NavLink end to="/admin/blog" onClick={close}>Blog</NavLink>
      <NavLink end to="/admin/gallery" onClick={close}>Galerie</NavLink>
      <div className="admin-nav__group">
        <span>Web</span>
        <NavLink to="/admin/web/landing" onClick={close}>Landing page</NavLink>
        <NavLink to="/admin/web/o-mne" onClick={close}>O mně</NavLink>
        <NavLink to="/admin/web/kontakt" onClick={close}>Kontakt</NavLink>
      </div>
    </nav>
  )
}

export function AdminFrame({ title, actions, children }) {
  const navigate = useNavigate()
  const headingRef = useRouteFocus()
  const drawer = useDrawer()
  const authenticated = api.isAdmin()

  function logout() {
    api.logout()
    drawer.setOpen(false)
    navigate('/admin/login', { replace: true })
  }

  const sidebar = (
    <>
      <Link className="admin-brand" to="/">
        <img src="/assets/landing/small-logo.svg" alt="" />
        <span>Moniké</span>
      </Link>
      {authenticated && <AdminNavigation close={() => drawer.setOpen(false)} />}
      {authenticated && (
        <div className="admin-sidebar__footer">
          <a className="button button--secondary" href="/" target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" /> Zobrazit web
          </a>
          <button type="button" className="button button--quiet" onClick={logout}>
            <LogOut size={16} aria-hidden="true" /> Odhlásit
          </button>
        </div>
      )}
    </>
  )

  return (
    <div className="admin-page">
      <SkipLink />
      <header className="admin-mobile-header">
        <Link className="admin-brand" to="/">Moniké</Link>
        {authenticated && (
          <button
            ref={drawer.triggerRef}
            className="icon-button"
            type="button"
            aria-label="Otevřít menu administrace"
            aria-controls="admin-sidebar-mobile"
            aria-expanded={drawer.open}
            onClick={() => drawer.setOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
        )}
      </header>
      <aside className="admin-sidebar">{sidebar}</aside>
      {drawer.open && (
        <ModalDrawer
          open={drawer.open}
          id="admin-sidebar-mobile"
          label="Menu administrace"
          triggerRef={drawer.triggerRef}
          onClose={() => drawer.setOpen(false)}
        >
          <div className="admin-sidebar admin-sidebar--mobile">
            <button
              className="icon-button admin-sidebar__close"
              type="button"
              aria-label="Zavřít menu administrace"
              onClick={() => drawer.setOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
            {sidebar}
          </div>
        </ModalDrawer>
      )}
      <main id="main-content" className="admin-content" tabIndex="-1">
        <header className="admin-header">
          <h1 ref={headingRef} tabIndex="-1">{title}</h1>
          {actions}
        </header>
        {children}
      </main>
    </div>
  )
}
