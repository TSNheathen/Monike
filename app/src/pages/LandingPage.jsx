import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Facebook, Instagram, Menu, X } from 'lucide-react'
import { navItems } from '../data/landing.js'
import { loadLandingContent } from '../data/public-content.js'
import { usePublicResource } from '../hooks/usePublicResource.js'
import { usePageMetadata } from '../hooks/usePageMetadata.js'
import { pageMetadata } from '../lib/metadata.js'
import { pb } from '../lib/pocketbase.js'
import { responsiveImage } from '../lib/media.js'
import { StatePanel } from '../components/AsyncState.jsx'
import ModalDrawer from '../components/ModalDrawer.jsx'
import { useRouteFocus } from '../hooks/useRouteFocus.js'

const METADATA = pageMetadata({
  title: 'Moniké | Umění, cesty a příběhy',
  description: 'Osobní svět Moniké plný umění, cest, vzpomínek a příběhů.',
  path: '/',
})

function cardImageProps(card) {
  if (card.image.startsWith('/')) {
    return { src: card.image, width: card.image_width, height: card.image_height, loading: 'lazy' }
  }
  return responsiveImage(pb, {
    record: card,
    field: 'image',
    widthField: 'image_width',
    heightField: 'image_height',
    role: 'landing',
  })
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuTriggerRef = useRef(null)
  const headingRef = useRouteFocus()
  const request = usePublicResource(loadLandingContent)
  const content = request.state === 'ready' ? request.data : null
  usePageMetadata(METADATA)

  return (
    <main id="main-content" className="landing-page" tabIndex="-1">
      <a className="skip-link" href="#main-content">Přeskočit na hlavní obsah</a>
      <h1 ref={headingRef} id="hero-title" className="landing-title" tabIndex="-1">Moniké</h1>
      <picture className="landing-background" aria-hidden="true">
        <source media="(max-width: 720px)" srcSet="/assets/landing/background-mobile.png" />
        <img src="/assets/landing/background-desktop.png" alt="" />
      </picture>
      <div className="landing-overlay" aria-hidden="true" />
      <div className="bottom-panel" aria-hidden="true" />

      <Link className="top-logo" to="/" aria-label="Domů Moniké">
        <img src="/assets/landing/small-logo.svg" alt="" />
      </Link>

      <button
        ref={menuTriggerRef}
        type="button"
        className="mobile-menu-button"
        aria-label="Otevřít menu"
        aria-expanded={menuOpen}
        aria-controls="landing-mobile-menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      <nav className="side-nav" aria-label="Hlavní navigace">
        {navItems.map((item) => <Link key={item.label} to={item.href}>{item.label}</Link>)}
      </nav>

      {menuOpen && (
        <ModalDrawer
          open={menuOpen}
          id="landing-mobile-menu"
          label="Mobilní navigace"
          triggerRef={menuTriggerRef}
          onClose={() => setMenuOpen(false)}
        >
          <nav className="mobile-menu" aria-label="Hlavní navigace">
            <button
              type="button"
              className="icon-button landing-menu-close"
              aria-label="Zavřít menu"
              onClick={() => setMenuOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
            {navItems.map((item) => (
              <Link key={item.label} to={item.href} onClick={() => setMenuOpen(false)}>{item.label}</Link>
            ))}
          </nav>
        </ModalDrawer>
      )}

      {request.state === 'loading' && (
        <div className="landing-cms-state"><StatePanel state="loading" onRetry={request.retrying ? request.retry : undefined} retrying={request.retrying} /></div>
      )}
      {['unavailable', 'error', 'configuration'].includes(request.state) && (
        <div className="landing-cms-state">
          <StatePanel state={request.state} onRetry={request.retry} retrying={request.retrying}>
            <p>Obsah úvodní stránky se teď nepodařilo načíst.</p>
          </StatePanel>
        </div>
      )}

      {content && (
        <>
          <section className="hero-block" aria-labelledby="hero-title">
            <img className="hero-logo" src="/assets/landing/large-logo.svg" alt="" />
            <p className="hero-subtitle">{content.site.hero_subtitle}</p>
            <p className="hero-body">
              {content.site.hero_body.split('\n').map((line, index) => (
                <span key={`${line}-${index}`}>{line}{index < content.site.hero_body.split('\n').length - 1 && <br />}</span>
              ))}
            </p>
            <Link className="hero-cta" to="/gallery">{content.site.hero_cta_label}</Link>
          </section>

          <section className="category-cards" aria-label="Kategorie">
            {content.cards.map((card) => (
              <Link key={card.slot} className="category-card" to={card.href} data-testid="category-card">
                <img className="category-card-image" alt="" {...cardImageProps(card)} />
                <span className="category-card-title">{card.title}</span>
                <span className="category-card-description">{card.description}</span>
              </Link>
            ))}
          </section>

          <div className="social-links" aria-label="Sociální sítě">
            <a href={content.site.instagram_url} aria-label="Instagram Moniké" rel="noreferrer">
              <Instagram aria-hidden="true" size={19} />
            </a>
            <a href={content.site.facebook_url} aria-label="Facebook Moniké" rel="noreferrer">
              <Facebook aria-hidden="true" size={19} />
            </a>
          </div>

          {content.site.signature_text && <p className="signature" aria-hidden="true">{content.site.signature_text}</p>}
        </>
      )}
    </main>
  )
}
