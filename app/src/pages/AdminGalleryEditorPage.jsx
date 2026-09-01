import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminFrame } from '../components/SiteFrame.jsx'
import { Dialog } from '../components/Dialog.jsx'
import { StatePanel, StatusMessage } from '../components/AsyncState.jsx'
import ReauthenticationDialog from '../components/ReauthenticationDialog.jsx'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog.jsx'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js'
import { isAuthenticationError, normalizeApiError } from '../lib/api-errors.js'
import { api } from '../lib/pocketbase.js'
import { normalizeAdminImage } from '../lib/image-normalization.js'

const EMPTY_FORM = { title: '', alt_text: '', caption: '', published: false }

export default function AdminGalleryEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [state, setState] = useState(isNew ? 'ready' : 'loading')
  const [record, setRecord] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState('info')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)
  const guard = useUnsavedChanges(dirty)

  const load = useCallback(async () => {
    if (!id) return
    setState('loading')
    try {
      const item = await api.galleryImageById(id)
      const imageUrl = await api.protectedFileUrl(item, 'image', '800x1000')
      setRecord(item)
      setForm({
        title: item.title || '',
        alt_text: item.alt_text || '',
        caption: item.caption || '',
        published: Boolean(item.published),
      })
      setPreviewUrl(imageUrl)
      setFile(null)
      setDirty(false)
      setState('ready')
    } catch (error) {
      const normalized = normalizeApiError(error)
      if (isAuthenticationError(normalized)) setReauthOpen(true)
      setMessage(normalized.message)
      setState(normalized.kind)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  function update(patch) {
    setForm((current) => ({ ...current, ...patch }))
    setDirty(true)
    setMessage('')
  }

  async function selectImage(selected) {
    if (!selected) return
    setBusy(true)
    setMessageKind('info')
    setMessage('Připravuji bezpečný webový master…')
    try {
      setFile(await normalizeAdminImage(selected, { maxBytes: 10 * 1024 * 1024 }))
      setDirty(true)
      setMessage('Obrázek je připravený. Změnu potvrď uložením.')
    } catch (error) {
      setMessageKind('error')
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function save(event) {
    event.preventDefault()
    if (isNew && !file) {
      setMessageKind('error')
      setMessage('Vyber obrázek k nahrání.')
      return
    }
    if (form.published && !form.alt_text.trim()) {
      setMessageKind('error')
      setMessage('Publikovaný obrázek musí mít alternativní text.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const data = new FormData()
      data.set('title', form.title)
      data.set('alt_text', form.alt_text)
      data.set('caption', form.caption)
      data.set('published', String(form.published))
      if (file) data.set('image', file)
      const saved = record
        ? await api.updateGalleryImage(record.id, data)
        : await api.createGalleryImage(data)
      setRecord(saved)
      setDirty(false)
      setFile(null)
      setPreviewUrl(await api.protectedFileUrl(saved, 'image', '800x1000'))
      setMessageKind('success')
      setMessage('Obrázek je uložený.')
      if (isNew) {
        guard.allowNextNavigation()
        navigate(`/admin/gallery/${saved.id}/edit`, { replace: true })
      }
    } catch (error) {
      const normalized = normalizeApiError(error)
      setMessageKind('error')
      if (isAuthenticationError(normalized)) {
        setReauthOpen(true)
        setMessage('Přihlášení vypršelo. Po obnovení uložení vědomě zopakuj.')
      } else setMessage(normalized.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!record) return
    setBusy(true)
    try {
      await api.deleteGalleryImage(record.id)
      guard.allowNextNavigation()
      navigate('/admin/gallery', { replace: true })
    } catch (error) {
      const normalized = normalizeApiError(error)
      setDeleteOpen(false)
      setMessageKind('error')
      if (isAuthenticationError(normalized)) {
        setReauthOpen(true)
        setMessage('Přihlášení vypršelo. Po obnovení smazání vědomě zopakuj.')
      } else setMessage(normalized.message)
    } finally {
      setBusy(false)
    }
  }

  if (state !== 'ready') {
    return <AdminFrame title="Obrázek galerie"><StatePanel state={state} title={state === 'loading' ? undefined : 'Obrázek se nepodařilo načíst'} onRetry={state === 'loading' ? undefined : load}><p>{message}</p></StatePanel></AdminFrame>
  }

  return (
    <AdminFrame title={isNew ? 'Nový obrázek' : 'Upravit obrázek'}>
      <form className="admin-form" onSubmit={save}>
        {previewUrl && <img className="admin-gallery-preview" src={previewUrl} alt="Aktuální obrázek galerie" />}
        <label>
          Název
          <input required maxLength="160" value={form.title} onChange={(event) => update({ title: event.target.value })} />
        </label>
        <label>
          {isNew ? 'Obrázek' : 'Nahradit obrázek'}
          <input type="file" accept="image/jpeg,image/png,image/webp" required={isNew} onChange={(event) => selectImage(event.target.files?.[0])} />
        </label>
        <label>
          Alternativní text
          <input maxLength="220" value={form.alt_text} onChange={(event) => update({ alt_text: event.target.value })} />
        </label>
        <label>
          Popisek
          <textarea maxLength="500" value={form.caption} onChange={(event) => update({ caption: event.target.value })} />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={form.published} onChange={(event) => update({ published: event.target.checked })} />
          Zobrazit ve veřejné galerii
        </label>
        <StatusMessage kind={messageKind}>{message}</StatusMessage>
        <div className="admin-editor-actions">
          <button className="button button--primary" type="submit" disabled={busy}>Uložit obrázek</button>
          {record && <button className="button button--danger" type="button" disabled={busy} onClick={() => setDeleteOpen(true)}>Trvale smazat</button>}
        </div>
      </form>
      <Dialog open={deleteOpen} title="Trvale smazat obrázek?" onClose={() => setDeleteOpen(false)}>
        <p>Obrázek bude odstraněn z administrace i veřejné galerie. Tuto akci nelze vrátit.</p>
        <div className="dialog-actions">
          <button data-dialog-initial className="button button--secondary" type="button" onClick={() => setDeleteOpen(false)}>Zrušit</button>
          <button className="button button--danger" type="button" disabled={busy} onClick={remove}>Trvale smazat</button>
        </div>
      </Dialog>
      <ReauthenticationDialog open={reauthOpen} email={api.ownerEmail()} authenticate={api.reauthenticate} onSuccess={() => { setReauthOpen(false); setMessageKind('success'); setMessage('Přihlášení bylo obnoveno. Původní akci teď vědomě zopakuj.') }} onCancel={() => setReauthOpen(false)} />
      <UnsavedChangesDialog open={Boolean(guard.pendingLocation)} onStay={guard.stay} onDiscard={guard.discardAndLeave} />
    </AdminFrame>
  )
}
