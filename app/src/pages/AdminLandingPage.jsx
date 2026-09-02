import { useCallback, useEffect, useState } from 'react'
import { AdminFrame } from '../components/SiteFrame.jsx'
import { StatePanel, StatusMessage } from '../components/AsyncState.jsx'
import ReauthenticationDialog from '../components/ReauthenticationDialog.jsx'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog.jsx'
import { LANDING_CARD_SLOTS } from '../data/landing.js'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js'
import { isAuthenticationError, normalizeApiError } from '../lib/api-errors.js'
import { api } from '../lib/pocketbase.js'
import { normalizeAdminImage } from '../lib/image-normalization.js'

export default function AdminLandingPage() {
  const [state, setState] = useState('loading')
  const [site, setSite] = useState(null)
  const [cards, setCards] = useState([])
  const [labels, setLabels] = useState([])
  const [cardUrls, setCardUrls] = useState({})
  const [cardFiles, setCardFiles] = useState({})
  const [dirtyKeys, setDirtyKeys] = useState(new Set())
  const [busyKey, setBusyKey] = useState('')
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState('info')
  const [reauthOpen, setReauthOpen] = useState(false)
  const guard = useUnsavedChanges(dirtyKeys.size > 0)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const [siteRecord, cardRecords, labelRecords] = await Promise.all([
        api.siteContent(),
        api.landingCards(),
        api.blogLabels(),
      ])
      const bySlot = new Map(cardRecords.map((card) => [card.slot, card]))
      if (cardRecords.length !== 5 || LANDING_CARD_SLOTS.some(({ slot }) => !bySlot.has(slot))) {
        setState('configuration')
        setMessage('Landing page musí obsahovat právě pět pevných karet.')
        return
      }
      const ordered = LANDING_CARD_SLOTS.map(({ slot }) => bySlot.get(slot))
      const urls = []
      for (const card of ordered) {
        // PocketBase auto-cancels identical concurrent file-token requests.
        // Resolve this tiny fixed set sequentially and reuse no stale token.
        urls.push(await api.protectedFileUrl(card, 'image', '800x0'))
      }
      setSite(siteRecord)
      setCards(ordered)
      setLabels(labelRecords)
      setCardUrls(Object.fromEntries(ordered.map((card, index) => [card.id, urls[index]])))
      setCardFiles({})
      setDirtyKeys(new Set())
      setState('ready')
    } catch (error) {
      const normalized = normalizeApiError(error)
      if (isAuthenticationError(normalized)) setReauthOpen(true)
      setMessage(normalized.message)
      setState(normalized.kind)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function markDirty(key) {
    setDirtyKeys((current) => new Set([...current, key]))
    setMessage('')
  }

  function clearDirty(key) {
    setDirtyKeys((current) => {
      const next = new Set(current)
      next.delete(key)
      return next
    })
  }

  function updateSite(field, value) {
    setSite((current) => ({ ...current, [field]: value }))
    markDirty('site')
  }

  function updateCard(id, field, value) {
    setCards((current) => current.map((card) => card.id === id ? { ...card, [field]: value } : card))
    markDirty(id)
  }

  async function perform(key, action, success) {
    setBusyKey(key)
    setMessage('')
    try {
      await action()
      clearDirty(key)
      setMessageKind('success')
      setMessage(success)
    } catch (error) {
      const normalized = normalizeApiError(error)
      setMessageKind('error')
      if (isAuthenticationError(normalized)) {
        setReauthOpen(true)
        setMessage('Přihlášení vypršelo. Po obnovení akci vědomě zopakuj.')
      } else setMessage(normalized.message)
    } finally {
      setBusyKey('')
    }
  }

  function saveSite() {
    return perform('site', async () => {
      const saved = await api.updateSiteContent(site.id, {
        hero_subtitle: site.hero_subtitle,
        hero_body: site.hero_body,
        hero_cta_label: site.hero_cta_label,
        signature_text: site.signature_text,
        instagram_url: site.instagram_url,
        facebook_url: site.facebook_url,
      })
      setSite(saved)
    }, 'Texty úvodní stránky jsou uložené.')
  }

  function saveCard(card) {
    return perform(card.id, async () => {
      const data = new FormData()
      data.set('title', card.title)
      data.set('description', card.description)
      data.set('label', card.label || '')
      if (cardFiles[card.id]) data.set('image', cardFiles[card.id])
      const saved = await api.updateLandingCard(card.id, data)
      setCards((current) => current.map((item) => item.id === card.id ? saved : item))
      setCardFiles((current) => ({ ...current, [card.id]: null }))
      setCardUrls((current) => ({ ...current, [card.id]: current[card.id] }))
      if (saved.image) {
        const url = await api.protectedFileUrl(saved, 'image', '800x0')
        setCardUrls((current) => ({ ...current, [card.id]: url }))
      }
    }, `Karta „${card.title}“ je uložená.`)
  }

  async function selectCardImage(cardId, selected) {
    if (!selected) return
    setBusyKey(cardId)
    setMessageKind('info')
    setMessage('Připravuji bezpečný webový master…')
    try {
      const normalized = await normalizeAdminImage(selected, { maxBytes: 10 * 1024 * 1024 })
      setCardFiles((current) => ({ ...current, [cardId]: normalized }))
      markDirty(cardId)
      setMessage('Obrázek karty je připravený. Změnu potvrď uložením karty.')
    } catch (error) {
      setMessageKind('error')
      setMessage(error.message)
    } finally {
      setBusyKey('')
    }
  }

  return (
    <AdminFrame title="Landing page">
      {state !== 'ready' && <StatePanel state={state} title={state === 'loading' ? undefined : 'Landing page se nepodařilo načíst'} onRetry={state === 'loading' ? undefined : load}><p>{message}</p></StatePanel>}
      {state === 'ready' && (
        <div className="admin-static-stack">
          <StatusMessage kind={messageKind}>{message}</StatusMessage>
          <section className="panel admin-static-section">
            <h2>Úvodní texty</h2>
            <div className="admin-form">
              <label>Podtitulek<input required maxLength="160" value={site.hero_subtitle} onChange={(event) => updateSite('hero_subtitle', event.target.value)} /></label>
              <label>Úvodní text<textarea required maxLength="1200" value={site.hero_body} onChange={(event) => updateSite('hero_body', event.target.value)} /></label>
              <label>Text tlačítka do galerie<input required maxLength="80" value={site.hero_cta_label} onChange={(event) => updateSite('hero_cta_label', event.target.value)} /></label>
              <label>Podpis<input maxLength="160" value={site.signature_text || ''} onChange={(event) => updateSite('signature_text', event.target.value)} /></label>
              <label>Instagram URL<input type="url" required value={site.instagram_url} onChange={(event) => updateSite('instagram_url', event.target.value)} /></label>
              <label>Facebook URL<input type="url" required value={site.facebook_url} onChange={(event) => updateSite('facebook_url', event.target.value)} /></label>
              <button className="button button--primary" type="button" disabled={!dirtyKeys.has('site') || busyKey === 'site'} onClick={saveSite}>Uložit úvodní texty</button>
            </div>
          </section>
          <section className="admin-static-cards" aria-labelledby="landing-cards-heading">
            <h2 id="landing-cards-heading">Pevné karty</h2>
            {cards.map((card) => (
              <article className="panel admin-static-section admin-landing-card" key={card.id}>
                <img src={cardUrls[card.id]} alt="" />
                <div className="admin-form">
                  <p className="admin-item__slug">Pevný slot: {card.slot}</p>
                  <label>Název<input required maxLength="100" value={card.title} onChange={(event) => updateCard(card.id, 'title', event.target.value)} /></label>
                  <label>Popis<textarea required maxLength="500" value={card.description} onChange={(event) => updateCard(card.id, 'description', event.target.value)} /></label>
                  {card.slot !== 'gallery' && (
                    <label>
                      Cílový label
                      <select value={card.label || ''} onChange={(event) => updateCard(card.id, 'label', event.target.value)}>
                        <option value="">Celý blog</option>
                        {labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}
                      </select>
                    </label>
                  )}
                  <label>Nahradit obrázek<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectCardImage(card.id, event.target.files?.[0])} /></label>
                  <button className="button button--primary" type="button" disabled={!dirtyKeys.has(card.id) || busyKey === card.id} onClick={() => saveCard(card)}>Uložit kartu</button>
                </div>
              </article>
            ))}
          </section>
        </div>
      )}
      <ReauthenticationDialog open={reauthOpen} email={api.ownerEmail()} authenticate={api.reauthenticate} onSuccess={() => { setReauthOpen(false); setMessageKind('success'); setMessage('Přihlášení bylo obnoveno. Původní akci teď vědomě zopakuj.') }} onCancel={() => setReauthOpen(false)} />
      <UnsavedChangesDialog open={Boolean(guard.pendingLocation)} onStay={guard.stay} onDiscard={guard.discardAndLeave} />
    </AdminFrame>
  )
}
