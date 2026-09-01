import { Link } from 'react-router-dom'
import { BLOG_CATEGORIES } from '../config/categories.js'
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

export function BlogCategoryNavigation({ currentKey = null }) {
  return (
    <nav className="category-nav" aria-label="Kategorie blogu">
      <Link className={!currentKey ? 'active' : undefined} to="/blog">Všechny články</Link>
      {BLOG_CATEGORIES.map((category) => (
        <Link
          key={category.key}
          className={currentKey === category.key ? 'active' : undefined}
          aria-current={currentKey === category.key ? 'page' : undefined}
          to={`/blog?category=${category.key}`}
        >
          {category.label}
        </Link>
      ))}
    </nav>
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
