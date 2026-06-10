import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Facebook, Instagram, Menu, X } from 'lucide-react'
import { categoryCards, navItems } from '../data/landing.js'

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="landing-page">
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
        type="button"
        className="mobile-menu-button"
        aria-label="Otevřít menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      <nav className="side-nav" aria-label="Hlavní navigace">
        {navItems.map((item) => (
          <Link key={item.label} to={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      {menuOpen && (
        <div className="mobile-menu" role="dialog" aria-label="Mobilní navigace">
          {navItems.map((item) => (
            <Link key={item.label} to={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      )}

      <section className="hero-block" aria-labelledby="hero-title">
        <img className="hero-logo" src="/assets/landing/large-logo.svg" alt="" />
        <h1 id="hero-title">Moniké</h1>
        <p className="hero-subtitle">Tvořím. Cestuji. Žiju.</p>
        <p className="hero-body">
          Umění je můj jazyk.
          <br />
          Cestování moje inspirace.
          <br />
          Okamžiky moje vzpomínky.
          <br />
          Tady sdílím vše, co tvoří můj svět.
        </p>
        <Link className="hero-cta" to="/gallery">
          VSTOUPIT DO MÉHO SVĚTA
        </Link>
      </section>

      <section className="category-cards" aria-label="Kategorie">
        {categoryCards.map((card) => (
          <Link
            key={card.title}
            className="category-card"
            to={card.href}
            data-testid="category-card"
            style={{ '--card-image': `url(${card.image})` }}
          >
            <span className="category-card-title">{card.title}</span>
            <span className="category-card-description">{card.description}</span>
          </Link>
        ))}
      </section>

      <div className="social-links" aria-label="Sociální sítě">
        <a href="#" aria-label="Instagram Moniké">
          <Instagram aria-hidden="true" size={19} />
        </a>
        <a href="#" aria-label="Facebook Moniké">
          <Facebook aria-hidden="true" size={19} />
        </a>
      </div>

      <p className="signature" aria-hidden="true">
        Collect moments, not things
      </p>
    </main>
  )
}
