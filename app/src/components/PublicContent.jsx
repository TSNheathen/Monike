import { Link } from 'react-router-dom'
import { StatePanel } from './AsyncState.jsx'

export function PublicRequestState({ state, emptyMessage, onRetry, retrying = false, children }) {
  if (state === 'loading') return <StatePanel state="loading" onRetry={retrying ? onRetry : undefined} retrying={retrying} />
  if (state === 'empty') return <StatePanel state="empty"><p>{emptyMessage}</p></StatePanel>
  if (state === 'invalid') return children
  if (state === 'not-found') return <StatePanel state="not-found">{children}</StatePanel>
  if (state === 'unavailable' || state === 'error' || state === 'configuration') {
    return (
      <StatePanel state={state} onRetry={onRetry} retrying={retrying}>
        <p>Obsah se teď nepodařilo načíst. Zkus to prosím znovu.</p>
      </StatePanel>
    )
  }
  return children
}

export function labelAccent(label) {
  return { '--label-color': label?.color || '#B88A36' }
}

export function BlogLabelNavigation({ labels = [], currentSlug = null }) {
  return (
    <nav className="label-nav" aria-label="Labely blogu">
      <Link className={!currentSlug ? 'active' : undefined} to="/blog">Všechny články</Link>
      {labels.map((label) => (
        <Link
          key={label.id}
          className={currentSlug === label.slug ? 'active' : undefined}
          aria-current={currentSlug === label.slug ? 'page' : undefined}
          style={labelAccent(label)}
          to={`/blog?label=${encodeURIComponent(label.slug)}`}
        >
          {label.name}
        </Link>
      ))}
    </nav>
  )
}

export function BlogLabelChips({ labels = [] }) {
  if (!labels.length) return null
  return (
    <div className="label-chips" aria-label="Labely článku">
      {labels.map((label) => (
        <Link
          key={label.id}
          style={labelAccent(label)}
          to={`/blog?label=${encodeURIComponent(label.slug)}`}
        >
          {label.name}
        </Link>
      ))}
    </div>
  )
}

export function ImageWithFallback({ fallbackLabel, className, ...props }) {
  return (
    <span className={`image-frame ${className || ''}`}>
      <img
        {...props}
        onError={(event) => {
          event.currentTarget.hidden = true
          event.currentTarget.nextElementSibling.hidden = false
        }}
      />
      <span className="image-fallback" hidden>{fallbackLabel || 'Obrázek se nepodařilo načíst.'}</span>
    </span>
  )
}
