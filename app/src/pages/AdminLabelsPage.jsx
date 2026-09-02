import { useCallback, useState, useEffect } from 'react'
import { AdminFrame } from '../components/SiteFrame.jsx'
import { Dialog } from '../components/Dialog.jsx'
import { StatePanel, StatusMessage } from '../components/AsyncState.jsx'
import ReauthenticationDialog from '../components/ReauthenticationDialog.jsx'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog.jsx'
import { labelAccent } from '../components/PublicContent.jsx'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js'
import { API_ERROR_KINDS, isAuthenticationError, normalizeApiError } from '../lib/api-errors.js'
import { api } from '../lib/pocketbase.js'

const EMPTY_LABEL = { name: '', slug: '', color: '#B88A36', sort_order: 0 }

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function validLabel(label) {
  return Boolean(
    label.name.trim() &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label.slug) &&
    /^#[0-9A-Fa-f]{6}$/.test(label.color) &&
    Number.isInteger(Number(label.sort_order)) &&
    Number(label.sort_order) >= 0,
  )
}

function payload(label) {
  return {
    name: label.name.trim(),
    slug: label.slug.trim().toLowerCase(),
    color: label.color.toUpperCase(),
    sort_order: Number(label.sort_order),
  }
}

function LabelFields({ label, prefix, onChange }) {
  return (
    <div className="admin-form admin-label-fields">
      <label>
        Název
        <input required maxLength="80" aria-label={`Název ${prefix}`} value={label.name} onChange={(event) => onChange('name', event.target.value)} />
      </label>
      <label>
        Slug
        <input required maxLength="80" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" aria-label={`Slug ${prefix}`} value={label.slug} onChange={(event) => onChange('slug', event.target.value.toLowerCase())} />
      </label>
      <div className="admin-label-color-fields">
        <label>
          Barva
          <input type="color" aria-label={`Barva ${prefix}`} value={label.color} onChange={(event) => onChange('color', event.target.value.toUpperCase())} />
        </label>
        <label>
          HEX barva
          <input required maxLength="7" pattern="#[0-9A-Fa-f]{6}" aria-label={`HEX barva ${prefix}`} value={label.color} onChange={(event) => onChange('color', event.target.value.toUpperCase())} />
        </label>
      </div>
      <label>
        Pořadí
        <input type="number" min="0" step="1" aria-label={`Pořadí ${prefix}`} value={label.sort_order} onChange={(event) => onChange('sort_order', event.target.value)} />
      </label>
    </div>
  )
}

export default function AdminLabelsPage() {
  const [state, setState] = useState('loading')
  const [labels, setLabels] = useState([])
  const [newLabel, setNewLabel] = useState(EMPTY_LABEL)
  const [newSlugTouched, setNewSlugTouched] = useState(false)
  const [dirtyKeys, setDirtyKeys] = useState(new Set())
  const [busyKey, setBusyKey] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState('info')
  const [reauthOpen, setReauthOpen] = useState(false)
  const guard = useUnsavedChanges(dirtyKeys.size > 0)

  const load = useCallback(async () => {
    setState('loading')
    setMessage('')
    try {
      setLabels(await api.blogLabels())
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

  function updateNew(field, value) {
    setNewLabel((current) => ({
      ...current,
      [field]: value,
      ...(field === 'name' && !newSlugTouched ? { slug: slugify(value) } : {}),
    }))
    if (field === 'slug') setNewSlugTouched(true)
    markDirty('new')
  }

  function updateExisting(id, field, value) {
    setLabels((current) => current.map((label) =>
      label.id === id ? { ...label, [field]: value } : label))
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
        setMessage('Přihlášení vypršelo. Po obnovení akci zopakuj.')
      } else if (normalized.kind === API_ERROR_KINDS.CONFLICT) {
        setMessage('Label se stále používá. Nejdřív ho odeber nebo nahraď u článků a landing karet.')
      } else if (normalized.kind === API_ERROR_KINDS.VALIDATION) {
        setMessage('Label není platný nebo už jeho slug používá jiný label.')
      } else setMessage(normalized.message)
    } finally {
      setBusyKey('')
    }
  }

  function createLabel() {
    if (!validLabel(newLabel)) {
      setMessageKind('error')
      setMessage('Doplň název, platný slug, HEX barvu a nezáporné celé pořadí.')
      return
    }
    return perform('new', async () => {
      const saved = await api.createBlogLabel(payload(newLabel))
      setLabels((current) => [...current, saved].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'cs')))
      setNewLabel(EMPTY_LABEL)
      setNewSlugTouched(false)
    }, 'Label je vytvořený.')
  }

  function saveLabel(label) {
    if (!validLabel(label)) {
      setMessageKind('error')
      setMessage('Doplň název, platný slug, HEX barvu a nezáporné celé pořadí.')
      return
    }
    return perform(label.id, async () => {
      const saved = await api.updateBlogLabel(label.id, payload(label))
      setLabels((current) => current
        .map((item) => item.id === label.id ? saved : item)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'cs')))
    }, `Label „${label.name}“ je uložený.`)
  }

  function deleteLabel() {
    if (!deleteTarget) return
    const target = deleteTarget
    return perform(target.id, async () => {
      await api.deleteBlogLabel(target.id)
      setLabels((current) => current.filter((label) => label.id !== target.id))
      setDeleteTarget(null)
    }, `Label „${target.name}“ je smazaný.`)
  }

  return (
    <AdminFrame title="Labels">
      {state !== 'ready' && (
        <StatePanel state={state} title={state === 'loading' ? undefined : 'Labely se nepodařilo načíst'} onRetry={state === 'loading' ? undefined : load}>
          {message && <p>{message}</p>}
        </StatePanel>
      )}
      {state === 'ready' && (
        <div className="admin-static-stack">
          <StatusMessage kind={messageKind}>{message}</StatusMessage>
          <section className="panel admin-static-section">
            <h2>Nový label</h2>
            <LabelFields label={newLabel} prefix="nového labelu" onChange={updateNew} />
            <button className="button button--primary" type="button" disabled={busyKey === 'new'} onClick={createLabel}>Vytvořit label</button>
          </section>
          <section className="admin-label-grid" aria-label="Existující labely">
            {labels.map((label) => (
              <article className="panel admin-static-section admin-label-card" key={label.id}>
                <h2><span className="admin-label-chip" style={labelAccent(label)}>{label.name}</span></h2>
                <LabelFields label={label} prefix={`labelu ${label.name}`} onChange={(field, value) => updateExisting(label.id, field, value)} />
                <div className="admin-label-actions">
                  <button className="button button--primary" type="button" disabled={!dirtyKeys.has(label.id) || busyKey === label.id} onClick={() => saveLabel(label)}>Uložit</button>
                  <button className="button button--danger" type="button" disabled={busyKey === label.id} onClick={() => setDeleteTarget(label)}>Smazat</button>
                </div>
              </article>
            ))}
          </section>
        </div>
      )}
      <Dialog open={Boolean(deleteTarget)} title="Trvale smazat label?" onClose={() => setDeleteTarget(null)}>
        <p>Label lze smazat pouze tehdy, pokud ho nepoužívá žádný článek ani landing karta.</p>
        {messageKind === 'error' && <StatusMessage kind="error">{message}</StatusMessage>}
        <div className="dialog-actions">
          <button data-dialog-initial className="button button--secondary" type="button" onClick={() => setDeleteTarget(null)}>Zrušit</button>
          <button className="button button--danger" type="button" disabled={Boolean(busyKey)} onClick={deleteLabel}>Trvale smazat</button>
        </div>
      </Dialog>
      <ReauthenticationDialog open={reauthOpen} email={api.ownerEmail()} authenticate={api.reauthenticate} onSuccess={() => { setReauthOpen(false); setMessageKind('success'); setMessage('Přihlášení bylo obnoveno. Původní akci teď zopakuj.') }} onCancel={() => setReauthOpen(false)} />
      <UnsavedChangesDialog open={Boolean(guard.pendingLocation)} onStay={guard.stay} onDiscard={guard.discardAndLeave} />
    </AdminFrame>
  )
}
