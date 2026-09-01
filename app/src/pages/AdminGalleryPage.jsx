import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminFrame } from '../components/SiteFrame.jsx'
import { StatePanel, StatusBadge, StatusMessage } from '../components/AsyncState.jsx'
import ReauthenticationDialog from '../components/ReauthenticationDialog.jsx'
import { isAuthenticationError, normalizeApiError } from '../lib/api-errors.js'
import { api } from '../lib/pocketbase.js'

export default function AdminGalleryPage() {
  const [state, setState] = useState('loading')
  const [items, setItems] = useState([])
  const [dirtyOrder, setDirtyOrder] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState('info')
  const [reauthOpen, setReauthOpen] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    setMessage('')
    try {
      const records = await api.gallery(false)
      setItems(records)
      setDirtyOrder(false)
      setState(records.length ? 'ready' : 'empty')
    } catch (error) {
      const normalized = normalizeApiError(error)
      if (isAuthenticationError(normalized)) setReauthOpen(true)
      setMessage(normalized.message)
      setState(normalized.kind)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function move(index, offset) {
    const target = index + offset
    if (target < 0 || target >= items.length) return
    const movedTitle = items[index].title
    setItems((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setDirtyOrder(true)
    setMessage(`${movedTitle} je nyní ${target + 1}. z ${items.length}. Změnu potvrď tlačítkem Uložit pořadí.`)
    setMessageKind('info')
  }

  async function saveOrder() {
    setBusy(true)
    setMessage('')
    try {
      await api.reorderGallery(
        items.map(({ id }) => id),
        Object.fromEntries(items.map(({ id, updated }) => [id, updated])),
      )
      setDirtyOrder(false)
      setMessageKind('success')
      setMessage('Pořadí galerie je uložené.')
    } catch (error) {
      const normalized = normalizeApiError(error)
      setMessageKind('error')
      if (isAuthenticationError(normalized)) {
        setReauthOpen(true)
        setMessage('Přihlášení vypršelo. Po obnovení ulož pořadí znovu.')
      } else setMessage(normalized.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminFrame
      title="Galerie"
      actions={<Link className="admin-action" to="/admin/gallery/new">Nový obrázek</Link>}
    >
      {state === 'loading' && <StatePanel state="loading" />}
      {state === 'empty' && <StatePanel state="empty" title="Galerie je prázdná"><p>Nahraj první obrázek.</p></StatePanel>}
      {!['loading', 'empty', 'ready'].includes(state) && (
        <StatePanel state={state} title="Galerii se nepodařilo načíst" onRetry={load}><p>{message}</p></StatePanel>
      )}
      {state === 'ready' && (
        <>
          <StatusMessage kind={messageKind}>{message}</StatusMessage>
          <div className="admin-table admin-gallery-order">
            {items.map((item, index) => (
              <article key={item.id}>
                <img className="admin-gallery-thumb" src={item.imageUrl} alt="" />
                <div className="admin-gallery-item__body">
                  <div className="admin-item__meta"><StatusBadge kind={item.published ? 'published' : 'draft'}>{item.published ? 'Publikováno' : 'Skryto'}</StatusBadge><span>Pořadí {index + 1}</span></div>
                  <h2>{item.title}</h2>
                  <p>{item.caption}</p>
                </div>
                <div className="admin-order-actions" aria-label={`Pořadí: ${item.title}`}>
                  <button aria-label={`Posunout „${item.title}“ nahoru`} className="button button--secondary" type="button" disabled={index === 0} onClick={() => move(index, -1)}>Posunout nahoru</button>
                  <button aria-label={`Posunout „${item.title}“ dolů`} className="button button--secondary" type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)}>Posunout dolů</button>
                  <Link className="button button--secondary" to={`/admin/gallery/${item.id}/edit`}>Upravit</Link>
                </div>
              </article>
            ))}
          </div>
          <button className="button button--primary admin-save-order" type="button" disabled={!dirtyOrder || busy} onClick={saveOrder}>Uložit pořadí</button>
        </>
      )}
      <ReauthenticationDialog
        open={reauthOpen}
        email={api.ownerEmail()}
        authenticate={api.reauthenticate}
        onSuccess={() => { setReauthOpen(false); setMessageKind('success'); setMessage('Přihlášení bylo obnoveno. Akci vědomě zopakuj.') }}
        onCancel={() => setReauthOpen(false)}
      />
    </AdminFrame>
  )
}
