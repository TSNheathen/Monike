import { useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { landingNavigation } from '../data/landing.js'
import { parseLabelQuery } from '../lib/queries.js'

export default function PublicNavigation({ labels = [], state = 'ready', onRetry, className = 'side-nav', close }) {
  const [manuallyExpanded, setManuallyExpanded] = useState(false)
  const toggleRef = useRef(null)
  const groupId = useId()
  const location = useLocation()
  const onBlog = location.pathname === '/blog' || location.pathname.startsWith('/blog/')
  const expanded = onBlog || manuallyExpanded
  const filter = parseLabelQuery(new URLSearchParams(location.search))

  function collapse(event) {
    if (event.key === 'Escape' && expanded && !onBlog) {
      event.preventDefault()
      event.stopPropagation()
      setManuallyExpanded(false)
      toggleRef.current?.focus()
    }
  }

  function follow() {
    setManuallyExpanded(false)
    close?.()
  }

  return (
    <nav className={className} aria-label="Hlavní navigace">
      {landingNavigation(labels).map((item) => {
        const active = location.pathname === item.href && (item.href !== '/blog' || filter.state === 'all')
        const link = (
          <Link className={`public-navigation-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} to={item.href} onClick={follow}>
            {item.label}
          </Link>
        )
        if (!item.labels) return <div className="public-navigation-item" key={item.href}>{link}</div>
        return (
          <div className="public-blog-group" key={item.href} onKeyDown={collapse}>
            <button
              ref={toggleRef}
              type="button"
              className={`public-navigation-link${onBlog ? ' active' : ''}`}
              aria-expanded={expanded}
              aria-disabled={onBlog || undefined}
              aria-controls={groupId}
              onClick={() => { if (!onBlog) setManuallyExpanded((value) => !value) }}
            >
              {item.label}
            </button>
            <div id={groupId} className="public-blog-group__labels" hidden={!expanded}>
              <Link to={item.href} aria-current={active ? 'page' : undefined} onClick={follow}>Všechny články</Link>
              {state === 'loading' && <p role="status">Načítám štítky…</p>}
              {state !== 'ready' && state !== 'loading' && (
                <div><p>Štítky se nepodařilo načíst.</p><button type="button" onClick={onRetry}>Zkusit znovu</button></div>
              )}
              {state === 'ready' && item.labels.length === 0 && <p>Zatím žádné štítky.</p>}
              {item.labels.map((label) => (
                <Link
                  key={label.id}
                  to={`/blog?label=${encodeURIComponent(label.slug)}`}
                  aria-current={location.pathname === '/blog' && filter.slug === label.slug ? 'page' : undefined}
                  onClick={follow}
                >{label.name}</Link>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
