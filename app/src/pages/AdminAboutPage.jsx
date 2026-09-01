import { useCallback, useEffect, useState } from 'react'
import { AdminFrame } from '../components/SiteFrame.jsx'
import RichTextEditor from '../components/RichTextEditor.jsx'
import { StatePanel, StatusMessage } from '../components/AsyncState.jsx'
import ReauthenticationDialog from '../components/ReauthenticationDialog.jsx'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog.jsx'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js'
import { API_ERROR_KINDS, isAuthenticationError, normalizeApiError } from '../lib/api-errors.js'
import { api } from '../lib/pocketbase.js'
import { normalizeAdminImage } from '../lib/image-normalization.js'

function parseContent(value) {
  if (value?.type === 'doc') return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed?.type === 'doc') return parsed
    } catch {
      return null
    }
  }
  return null
}

export default function AdminAboutPage() {
  const [state, setState] = useState('loading')
  const [record, setRecord] = useState(null)
  const [content, setContent] = useState(null)
  const [portraitAlt, setPortraitAlt] = useState('')
  const [portraitFile, setPortraitFile] = useState(null)
  const [portraitUrl, setPortraitUrl] = useState('')
  const [assetUrls, setAssetUrls] = useState({})
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState('info')
  const [conflict, setConflict] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)
  const guard = useUnsavedChanges(dirty)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const about = await api.aboutPage()
      const parsed = parseContent(about.content_json)
      if (!parsed) {
        setState('configuration')
        setMessage('Stránka O mně obsahuje neplatný canonical JSON.')
        return
      }
      const assets = await api.contentAssets('about', about.id)
      const nextPortraitUrl = about.portrait
        ? await api.protectedFileUrl(about, 'portrait', '800x0')
        : ''
      setRecord(about)
      setContent(parsed)
      setPortraitAlt(about.portrait_alt || '')
      setPortraitFile(null)
      setPortraitUrl(nextPortraitUrl)
      setAssetUrls(Object.fromEntries(assets.map((asset) => [asset.id, asset.imageUrl])))
      setDirty(false)
      setConflict(false)
      setState('ready')
    } catch (error) {
      const normalized = normalizeApiError(error)
      if (isAuthenticationError(normalized)) setReauthOpen(true)
      setMessage(normalized.message)
      setState(normalized.kind)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function stageImage(file) {
    const data = new FormData()
    data.set('parentType', 'about')
    data.set('parentId', record.id)
    data.set('image', file)
    const asset = await api.stageContentAsset(data)
    setAssetUrls((current) => ({ ...current, [asset.id]: asset.imageUrl }))
    return asset
  }

  async function selectPortrait(selected) {
    if (!selected) return
    setBusy(true)
    setMessageKind('info')
    setMessage('Připravuji bezpečný webový master…')
    try {
      setPortraitFile(await normalizeAdminImage(selected, { maxBytes: 10 * 1024 * 1024 }))
      setDirty(true)
      setMessage('Portrét je připravený. Změnu potvrď uložením stránky.')
    } catch (error) {
      setMessageKind('error')
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if ((!record.portrait && !portraitFile) || !portraitAlt.trim()) {
      setMessageKind('error')
      setMessage('Portrét a jeho smysluplný alternativní text jsou povinné.')
      return
    }
    setBusy(true)
    setMessage('')
    setConflict(false)
    try {
      const story = await api.saveAbout({
        expectedUpdated: record.updated,
        content_json: content,
      })
      let saved = { ...record, ...story.record, content_json: content }
      // The portrait is an intentionally independent CRUD workflow. Preserve
      // the new rich-text version even if the following media update fails.
      setRecord(saved)
      const portrait = new FormData()
      portrait.set('portrait_alt', portraitAlt.trim())
      if (portraitFile) portrait.set('portrait', portraitFile)
      saved = await api.updateAboutPortrait(saved.id, portrait)
      const nextPortraitUrl = await api.protectedFileUrl(saved, 'portrait', '800x0')
      const assets = await api.contentAssets('about', saved.id)
      setRecord({ ...saved, content_json: content })
      setPortraitAlt(saved.portrait_alt)
      setPortraitFile(null)
      setPortraitUrl(nextPortraitUrl)
      setAssetUrls(Object.fromEntries(assets.map((asset) => [asset.id, asset.imageUrl])))
      setDirty(false)
      setMessageKind('success')
      setMessage('Stránka O mně je uložená.')
    } catch (error) {
      const normalized = normalizeApiError(error)
      setMessageKind('error')
      if (isAuthenticationError(normalized)) {
        setReauthOpen(true)
        setMessage('Přihlášení vypršelo. Po obnovení uložení vědomě zopakuj.')
      } else if (normalized.kind === API_ERROR_KINDS.CONFLICT) {
        setConflict(true)
        setMessage('Stránka byla mezitím změněna v jiné kartě. Načti aktuální verzi.')
      } else setMessage(normalized.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminFrame title="O mně">
      {state !== 'ready' && <StatePanel state={state} title={state === 'loading' ? undefined : 'Stránku O mně se nepodařilo načíst'} onRetry={state === 'loading' ? undefined : load}><p>{message}</p></StatePanel>}
      {state === 'ready' && (
        <div className="admin-form admin-form--wide">
          <fieldset className="admin-fieldset">
            <legend>Portrét</legend>
            {portraitUrl && <img className="admin-about-portrait" src={portraitUrl} alt="Aktuální portrét" />}
            <label>Nahradit portrét<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectPortrait(event.target.files?.[0])} /></label>
            <label>Alternativní text<input required maxLength="220" value={portraitAlt} onChange={(event) => { setPortraitAlt(event.target.value); setDirty(true) }} /></label>
          </fieldset>
          <div>
            <span className="admin-field-label">Příběh</span>
            <RichTextEditor value={content} onChange={(next) => { setContent(next); setDirty(true); setMessage('') }} onStageImage={stageImage} assetUrls={assetUrls} label="Příběh stránky O mně" />
          </div>
          <StatusMessage kind={messageKind}>{message}</StatusMessage>
          {conflict && <button className="button button--secondary" type="button" onClick={load}>Načíst aktuální verzi</button>}
          <button className="button button--primary" type="button" disabled={!dirty || busy} onClick={save}>Uložit stránku O mně</button>
        </div>
      )}
      <ReauthenticationDialog open={reauthOpen} email={api.ownerEmail()} authenticate={api.reauthenticate} onSuccess={() => { setReauthOpen(false); setMessageKind('success'); setMessage('Přihlášení bylo obnoveno. Původní akci teď vědomě zopakuj.') }} onCancel={() => setReauthOpen(false)} />
      <UnsavedChangesDialog open={Boolean(guard.pendingLocation)} onStay={guard.stay} onDiscard={guard.discardAndLeave} />
    </AdminFrame>
  )
}
