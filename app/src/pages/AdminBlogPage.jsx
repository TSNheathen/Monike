import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminFrame } from '../components/SiteFrame.jsx'
import { StatePanel, StatusBadge } from '../components/AsyncState.jsx'
import { labelAccent } from '../components/PublicContent.jsx'
import { normalizeApiError } from '../lib/api-errors.js'
import { api } from '../lib/pocketbase.js'

const DATE_FORMATTER = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium' })

function postStatus(post) {
  if (post.published) return { kind: 'published', label: 'Publikováno' }
  if (post.published_at) return { kind: 'warning', label: 'Skryto' }
  return { kind: 'draft', label: 'Koncept' }
}

export default function AdminBlogPage() {
  const [outcome, setOutcome] = useState({ state: 'loading', posts: [], error: null })

  const load = useCallback(async () => {
    setOutcome((current) => ({ ...current, state: 'loading', error: null }))
    try {
      const posts = await api.posts(false)
      setOutcome({ state: posts.length ? 'ready' : 'empty', posts, error: null })
    } catch (error) {
      const normalized = normalizeApiError(error)
      setOutcome({ state: normalized.kind, posts: [], error: normalized })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <AdminFrame
      title="Blog"
      actions={<Link className="admin-action" to="/admin/blog/new">Nový článek</Link>}
    >
      {outcome.state === 'loading' && <StatePanel state="loading" />}
      {outcome.state === 'empty' && (
        <StatePanel state="empty" title="Zatím tu není žádný článek">
          <p>Vytvoř první koncept a publikuj ho, až bude připravený.</p>
        </StatePanel>
      )}
      {!['loading', 'empty', 'ready'].includes(outcome.state) && (
        <StatePanel state={outcome.state} title="Články se nepodařilo načíst" onRetry={load}>
          <p>{outcome.error?.message}</p>
        </StatePanel>
      )}
      {outcome.state === 'ready' && (
        <div className="admin-table">
          {outcome.posts.map((post) => {
            const status = postStatus(post)
            const labels = post.expand?.labels || []
            return (
              <article key={post.id}>
                <div>
                  <div className="admin-item__meta">
                    <StatusBadge kind={status.kind}>{status.label}</StatusBadge>
                    <span>{post.published_at ? DATE_FORMATTER.format(new Date(post.published_at)) : 'Bez data publikace'}</span>
                  </div>
                  <h2>{post.title}</h2>
                  <div className="admin-label-chips" aria-label="Labely článku">
                    {labels.map((label) => (
                      <span key={label.id} style={labelAccent(label)}>{label.name}</span>
                    ))}
                  </div>
                  <p className="admin-item__slug">/blog/{post.slug}</p>
                </div>
                <Link className="button button--secondary" to={`/admin/blog/${post.id}/edit`}>Upravit</Link>
              </article>
            )
          })}
        </div>
      )}
    </AdminFrame>
  )
}
