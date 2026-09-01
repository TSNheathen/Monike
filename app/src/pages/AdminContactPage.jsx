import { useCallback, useEffect, useState } from 'react'
import { AdminFrame } from '../components/SiteFrame.jsx'
import { StatePanel, StatusMessage } from '../components/AsyncState.jsx'
import ReauthenticationDialog from '../components/ReauthenticationDialog.jsx'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog.jsx'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js'
import { isAuthenticationError, normalizeApiError } from '../lib/api-errors.js'
import { api } from '../lib/pocketbase.js'

export default function AdminContactPage() {
  const [state, setState] = useState('loading')
  const [record, setRecord] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState('info')
  const [reauthOpen, setReauthOpen] = useState(false)
  const guard = useUnsavedChanges(dirty)

  const load = useCallback(async () => {
    setState('loading')
    try {
      setRecord(await api.siteContent())
      setDirty(false)
      setState('ready')
    } catch (error) {
      const normalized = normalizeApiError(error)
      if (isAuthenticationError(normalized)) setReauthOpen(true)
      setMessage(normalized.message)
      setState(normalized.kind)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function update(field, value) {
    setRecord((current) => ({ ...current, [field]: value }))
    setDirty(true)
    setMessage('')
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const saved = await api.updateSiteContent(record.id, {
        contact_intro: record.contact_intro,
        contact_email: record.contact_email,
        instagram_url: record.instagram_url,
        facebook_url: record.facebook_url,
      })
      setRecord(saved)
      setDirty(false)
      setMessageKind('success')
      setMessage('Kontaktní údaje jsou uložené.')
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

  return (
    <AdminFrame title="Kontakt">
      {state !== 'ready' && <StatePanel state={state} title={state === 'loading' ? undefined : 'Kontakt se nepodařilo načíst'} onRetry={state === 'loading' ? undefined : load}><p>{message}</p></StatePanel>}
      {state === 'ready' && (
        <form className="admin-form" onSubmit={save}>
          <label>Úvodní text<textarea required maxLength="1000" value={record.contact_intro} onChange={(event) => update('contact_intro', event.target.value)} /></label>
          <label>E-mail<input type="email" required value={record.contact_email} onChange={(event) => update('contact_email', event.target.value)} /></label>
          <label>Instagram URL<input type="url" required value={record.instagram_url} onChange={(event) => update('instagram_url', event.target.value)} /></label>
          <label>Facebook URL<input type="url" required value={record.facebook_url} onChange={(event) => update('facebook_url', event.target.value)} /></label>
          <StatusMessage kind={messageKind}>{message}</StatusMessage>
          <button className="button button--primary" type="submit" disabled={!dirty || busy}>Uložit kontakt</button>
        </form>
      )}
      <ReauthenticationDialog open={reauthOpen} email={api.ownerEmail()} authenticate={api.reauthenticate} onSuccess={() => { setReauthOpen(false); setMessageKind('success'); setMessage('Přihlášení bylo obnoveno. Původní akci teď vědomě zopakuj.') }} onCancel={() => setReauthOpen(false)} />
      <UnsavedChangesDialog open={Boolean(guard.pendingLocation)} onStay={guard.stay} onDiscard={guard.discardAndLeave} />
    </AdminFrame>
  )
}
