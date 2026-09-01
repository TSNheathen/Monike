import { AlertTriangle, CircleAlert, LoaderCircle } from 'lucide-react'

const COPY = Object.freeze({
  loading: 'Načítám obsah…',
  empty: 'Zatím tu není žádný obsah.',
  invalid: 'Požadavek není platný.',
  'not-found': 'Obsah nebyl nalezen.',
  unavailable: 'Obsah teď není dostupný.',
  error: 'Obsah se nepodařilo načíst.',
  configuration: 'Obsah webu není správně nastavený.',
})

export function StatePanel({ state, title, children, onRetry, retrying = false }) {
  const isLoading = state === 'loading'
  const isUrgent = ['error', 'configuration'].includes(state)
  const Icon = isLoading ? LoaderCircle : isUrgent ? CircleAlert : AlertTriangle
  const role = isUrgent ? 'alert' : isLoading ? 'status' : undefined

  return (
    <section className={`state-panel state-panel--${state}`} role={role} aria-busy={isLoading || undefined}>
      <Icon className={isLoading ? 'state-panel__spinner' : ''} aria-hidden="true" />
      <div>
        <h2>{title || COPY[state] || COPY.error}</h2>
        {children}
        {onRetry && (
          <button
            className="button button--secondary"
            type="button"
            aria-disabled={retrying || undefined}
            onClick={retrying ? undefined : onRetry}
          >
            {retrying ? 'Načítám…' : 'Zkusit znovu'}
          </button>
        )}
      </div>
    </section>
  )
}

export function StatusMessage({ kind = 'info', children }) {
  if (!children) return null
  const urgent = kind === 'error' || kind === 'warning'
  return (
    <p
      className={`status-message status-message--${kind}`}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
    >
      {children}
    </p>
  )
}

export function StatusBadge({ kind = 'draft', children }) {
  return <span className={`status-badge status-badge--${kind}`}>{children}</span>
}
