import { useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ExternalLink, Facebook, Instagram, LogOut, Menu, X } from 'lucide-react'
import { loadBlogLabels, loadLandingContent } from '../data/public-content.js'
import { usePublicResource } from '../hooks/usePublicResource.js'
import { api } from '../lib/pocketbase.js'
import { useRouteFocus } from '../hooks/useRouteFocus.js'
import ModalDrawer from './ModalDrawer.jsx'
import PublicNavigation from './PublicNavigation.jsx'

function SkipLink() {
  return <a className="skip-link" href="#main-content">Přeskočit na hlavní obsah</a>
}

function useDrawer() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  return { open, setOpen, triggerRef }
}

export function PublicFrame({ title, children }) {
  const headingRef = useRouteFocus()
  const drawer = useDrawer()
  const navigationRequest = usePublicResource(loadLandingContent)
  const labelsRequest = usePublicResource(loadBlogLabels, [], ['blog_labels'])
  const navigationProps = { labels: labelsRequest.data || [], state: labelsRequest.state, onRetry: labelsRequest.retry }
  const sidebarContent = navigationRequest.state === 'ready' ? navigationRequest.data : null
  const instagramUrl = sidebarContent?.site?.instagram_url
  const facebookUrl = sidebarContent?.site?.facebook_url

  return (
    <div className="public-shell">
      <SkipLink />
      <aside className="public-sidebar" aria-label="Postranní panel Moniké">
        <Link className="top-logo" to="/" aria-label="Domů Moniké">
          <img src="/assets/landing/small-logo.svg" alt="" />
        </Link>
        <PublicNavigation {...navigationProps} />
        {(instagramUrl || facebookUrl) && (
          <div className="social-links" aria-label="Sociální sítě">
            {instagramUrl && (
              <a href={instagramUrl} aria-label="Instagram Moniké" rel="noreferrer">
                <Instagram aria-hidden="true" size={19} />
              </a>
            )}
            {facebookUrl && (
              <a href={facebookUrl} aria-label="Facebook Moniké" rel="noreferrer">
                <Facebook aria-hidden="true" size={19} />
              </a>
            )}
          </div>
        )}
      </aside>
      <header className="public-header">
        <Link className="public-mobile-logo" to="/" aria-label="Domů Moniké">
          <img src="/assets/landing/small-logo.svg" alt="" />
        </Link>
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
            <PublicNavigation {...navigationProps} className="public-drawer__nav" close={() => drawer.setOpen(false)} />
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
      <NavLink end to="/admin/labels" onClick={close}>Labels</NavLink>
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
