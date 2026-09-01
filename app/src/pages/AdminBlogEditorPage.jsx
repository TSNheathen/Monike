import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminFrame } from '../components/SiteFrame.jsx'
import RichTextEditor from '../components/RichTextEditor.jsx'
import { Dialog } from '../components/Dialog.jsx'
import { StatePanel, StatusBadge, StatusMessage } from '../components/AsyncState.jsx'
import ReauthenticationDialog from '../components/ReauthenticationDialog.jsx'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog.jsx'
import { BLOG_CATEGORIES } from '../config/categories.js'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js'
import { API_ERROR_KINDS, isAuthenticationError, normalizeApiError } from '../lib/api-errors.js'
import { EMPTY_RICH_TEXT } from '../lib/rich-text-client.js'
import { normalizeAdminImage } from '../lib/image-normalization.js'
import { api } from '../lib/pocketbase.js'

const EMPTY_FORM = {
  title: '',
  slug: '',
  excerpt: '',
  categories: [],
  content_json: EMPTY_RICH_TEXT,
}

function parseContent(value) {
  if (value?.type === 'doc') return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed?.type === 'doc') return parsed
    } catch {
      // The load state below keeps invalid backend content explicit.
    }
  }
  return null
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180)
}

function lifecycle(record) {
  if (record?.published) return { kind: 'published', label: 'Publikováno' }
  if (record?.published_at) return { kind: 'warning', label: 'Skryto' }
  return { kind: 'draft', label: 'Koncept' }
}

export default function AdminBlogEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [loadState, setLoadState] = useState(isNew ? 'ready' : 'loading')
  const [record, setRecord] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [aliases, setAliases] = useState([])
  const [assetUrls, setAssetUrls] = useState({})
  const [coverUrl, setCoverUrl] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [removeCover, setRemoveCover] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const [originalSlug, setOriginalSlug] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState('info')
  const [conflict, setConflict] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const titleRef = useRef(null)
  const slugRef = useRef(null)
  const titleErrorId = useId()
  const slugErrorId = useId()
  const categoriesErrorId = useId()
  const guard = useUnsavedChanges(dirty)

  const load = useCallback(async () => {
    if (!id) return
    setLoadState('loading')
    setMessage('')
    try {
      const [post, postAliases, assets] = await Promise.all([
        api.postById(id),
        api.postAliases(id),
        api.contentAssets('post', id),
      ])
      const content = parseContent(post.content_json)
      if (!content) {
        setLoadState('configuration')
        setMessage('Článek obsahuje neplatný canonical JSON a nelze ho bezpečně otevřít.')
        return
      }
      const nextUrls = Object.fromEntries(assets.map((asset) => [asset.id, asset.imageUrl]))
      const nextCoverUrl = post.cover_image
        ? await api.protectedFileUrl(post, 'cover_image', '800x0')
        : ''
      setRecord(post)
      setForm({
        title: post.title || '',
        slug: post.slug || '',
        excerpt: post.excerpt || '',
        categories: Array.isArray(post.categories) ? post.categories : [],
        content_json: content,
      })
      setAliases(postAliases)
      setAssetUrls(nextUrls)
      setCoverUrl(nextCoverUrl)
      setCoverFile(null)
      setRemoveCover(false)
      setOriginalSlug(post.slug || '')
      setDirty(false)
      setConflict(false)
      setLoadState('ready')
    } catch (error) {
      const normalized = normalizeApiError(error)
      if (isAuthenticationError(normalized)) setReauthOpen(true)
      setLoadState(normalized.kind)
      setMessage(normalized.message)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  function updateForm(patch) {
    setForm((current) => ({ ...current, ...patch }))
    setDirty(true)
    setMessage('')
    setConflict(false)
    setValidationErrors((current) => {
      const next = { ...current }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
  }

  function updateTitle(title) {
    updateForm({ title, ...(!slugTouched && isNew ? { slug: slugify(title) } : {}) })
  }

  function toggleCategory(key) {
    const categories = form.categories.includes(key)
      ? form.categories.filter((category) => category !== key)
      : [...form.categories, key]
    updateForm({ categories })
  }

  async function persistCover(postId, expectedUpdated) {
    if (!coverFile && !removeCover) return { updated: expectedUpdated, coverUrl }
    const data = new FormData()
    if (coverFile) data.set('cover_image', coverFile)
    else data.set('cover_image', '')
    const updated = await api.updatePostCover(postId, data)
    const nextCoverUrl = updated.cover_image
      ? await api.protectedFileUrl(updated, 'cover_image', '800x0')
      : ''
    return { updated: updated.updated, coverUrl: nextCoverUrl, record: updated }
  }

  async function save(published) {
    const errors = {}
    if (!form.title.trim()) errors.title = 'Název článku je povinný.'
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      errors.slug = 'Adresa smí obsahovat jen malá písmena, číslice a jednotlivé pomlčky.'
    }
    if (form.categories.length < 1 || form.categories.length > 4) {
      errors.categories = 'Vyber jednu až čtyři kategorie.'
    }
    if (Object.keys(errors).length) {
      setValidationErrors(errors)
      setMessageKind('error')
      setMessage('Oprav označená pole a ulož článek znovu.')
      requestAnimationFrame(() => {
        if (errors.title) titleRef.current?.focus()
        else if (errors.slug) slugRef.current?.focus()
        else document.querySelector('.admin-fieldset input[type="checkbox"]')?.focus()
      })
      return
    }
    setValidationErrors({})
    setBusy(true)
    setMessage('')
    setConflict(false)
    try {
      const payload = {
        ...(record ? { expectedUpdated: record.updated } : {}),
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        categories: form.categories,
        content_json: form.content_json,
        published,
      }
      const result = record
        ? await api.updatePost(record.id, payload)
        : await api.createPost(payload)
      let saved = { ...record, ...result.record }
      const cover = await persistCover(saved.id, saved.updated)
      saved = { ...saved, ...(cover.record || {}), updated: cover.updated }
      setRecord(saved)
      setCoverUrl(cover.coverUrl)
      setCoverFile(null)
      setRemoveCover(false)
      setOriginalSlug(saved.slug)
      setDirty(false)
      setMessageKind('success')
      setMessage(published ? 'Článek je uložený a publikovaný.' : saved.published_at ? 'Článek je uložený a skrytý.' : 'Koncept je uložený.')

      if (isNew) {
        guard.allowNextNavigation()
        navigate(`/admin/blog/${saved.id}/edit`, { replace: true })
      } else {
        const [postAliases, assets] = await Promise.all([
          api.postAliases(saved.id),
          api.contentAssets('post', saved.id),
        ])
        setAliases(postAliases)
        setAssetUrls(Object.fromEntries(assets.map((asset) => [asset.id, asset.imageUrl])))
      }
    } catch (error) {
      const normalized = normalizeApiError(error)
      setMessageKind('error')
      if (isAuthenticationError(normalized)) {
        setReauthOpen(true)
        setMessage('Přihlášení vypršelo. Po obnovení akci vědomě zopakuj.')
      } else if (normalized.kind === API_ERROR_KINDS.CONFLICT) {
        setConflict(true)
        setMessage('Článek byl mezitím změněn v jiné kartě. Načti aktuální verzi.')
      } else {
        setMessage(normalized.message)
      }
    } finally {
      setBusy(false)
    }
  }

  async function stageImage(file) {
    if (!record) throw new Error('Nejdřív ulož koncept článku.')
    const data = new FormData()
    data.set('parentType', 'post')
    data.set('parentId', record.id)
    data.set('image', file)
    const asset = await api.stageContentAsset(data)
    setAssetUrls((current) => ({ ...current, [asset.id]: asset.imageUrl }))
    return asset
  }

  async function selectCover(file) {
    if (!file) return
    setBusy(true)
    setMessageKind('info')
    setMessage('Připravuji bezpečný webový master…')
    try {
      setCoverFile(await normalizeAdminImage(file, { maxBytes: 5 * 1024 * 1024 }))
      setRemoveCover(false)
      setDirty(true)
      setMessage('Titulní obrázek je připravený. Změnu potvrď uložením článku.')
    } catch (error) {
      setMessageKind('error')
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function deletePost() {
    if (!record) return
    setBusy(true)
    try {
      await api.deletePost(record.id, record.updated)
      guard.allowNextNavigation()
      navigate('/admin/blog', { replace: true })
    } catch (error) {
      const normalized = normalizeApiError(error)
      setDeleteOpen(false)
      setMessageKind('error')
      if (isAuthenticationError(normalized)) {
        setReauthOpen(true)
        setMessage('Přihlášení vypršelo. Po obnovení smazání vědomě zopakuj.')
      } else if (normalized.kind === API_ERROR_KINDS.CONFLICT) {
        setConflict(true)
        setMessage('Článek byl mezitím změněn. Před smazáním načti aktuální verzi.')
      } else setMessage(normalized.message)
    } finally {
      setBusy(false)
    }
  }

  if (loadState !== 'ready') {
    return (
      <AdminFrame title={isNew ? 'Nový článek' : 'Upravit článek'}>
        <StatePanel
          state={loadState}
          title={loadState === 'loading' ? undefined : 'Článek se nepodařilo načíst'}
          onRetry={loadState === 'loading' ? undefined : load}
        >
          {message && <p>{message}</p>}
        </StatePanel>
        <ReauthenticationDialog
          open={reauthOpen}
          email={api.ownerEmail()}
          authenticate={api.reauthenticate}
          onSuccess={() => { setReauthOpen(false); setMessage('Přihlášení bylo obnoveno. Načti obsah znovu.') }}
          onCancel={() => setReauthOpen(false)}
        />
      </AdminFrame>
    )
  }

  const status = lifecycle(record)
  const slugWillChange = Boolean(record?.published_at && originalSlug && form.slug !== originalSlug)

  return (
    <AdminFrame title={isNew ? 'Nový článek' : 'Upravit článek'}>
      <div className="admin-form admin-form--wide">
        <div className="admin-editor-status">
          <StatusBadge kind={status.kind}>{status.label}</StatusBadge>
          {record?.published_at && <span>První publikace: {new Date(record.published_at).toLocaleString('cs-CZ')}</span>}
        </div>
        <label>
          Název
          <input ref={titleRef} required maxLength="160" value={form.title} aria-invalid={Boolean(validationErrors.title)} aria-describedby={validationErrors.title ? titleErrorId : undefined} onChange={(event) => updateTitle(event.target.value)} />
        </label>
        {validationErrors.title && <p id={titleErrorId} className="field-error">{validationErrors.title}</p>}
        <label>
          Adresa článku (slug)
          <input
            ref={slugRef}
            required
            maxLength="180"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            aria-invalid={Boolean(validationErrors.slug)}
            aria-describedby={validationErrors.slug ? slugErrorId : undefined}
            value={form.slug}
            onChange={(event) => { setSlugTouched(true); updateForm({ slug: event.target.value.toLowerCase() }) }}
          />
        </label>
        {validationErrors.slug && <p id={slugErrorId} className="field-error">{validationErrors.slug}</p>}
        {slugWillChange && (
          <StatusMessage kind="warning">Po uložení bude původní adresa /blog/{originalSlug} trvale přesměrovaná na novou.</StatusMessage>
        )}
        {aliases.length > 0 && (
          <details className="admin-aliases">
            <summary>Historie adres ({aliases.length})</summary>
            <ul>{aliases.map((alias) => <li key={alias.id}>/blog/{alias.slug}</li>)}</ul>
          </details>
        )}
        <label>
          Perex
          <textarea maxLength="500" value={form.excerpt} onChange={(event) => updateForm({ excerpt: event.target.value })} />
        </label>
        <fieldset className="admin-fieldset" aria-describedby={validationErrors.categories ? categoriesErrorId : undefined}>
          <legend>Kategorie (1–4)</legend>
          {BLOG_CATEGORIES.map(({ key, label }) => (
            <label className="checkbox-row" key={key}>
              <input type="checkbox" checked={form.categories.includes(key)} onChange={() => toggleCategory(key)} />
              {label}
            </label>
          ))}
        </fieldset>
        {validationErrors.categories && <p id={categoriesErrorId} className="field-error">{validationErrors.categories}</p>}
        <fieldset className="admin-fieldset">
          <legend>Titulní obrázek</legend>
          {coverUrl && !removeCover && <img className="admin-cover-preview" src={coverUrl} alt="Aktuální titulní obrázek" />}
          <label>
            Nahrát nový obrázek
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectCover(event.target.files?.[0])} />
          </label>
          {coverUrl && (
            <label className="checkbox-row">
              <input type="checkbox" checked={removeCover} onChange={(event) => { setRemoveCover(event.target.checked); setCoverFile(null); setDirty(true) }} />
              Odstranit titulní obrázek
            </label>
          )}
        </fieldset>
        <div>
          <span className="admin-field-label">Obsah</span>
          <RichTextEditor
            value={form.content_json}
            onChange={(content_json) => updateForm({ content_json })}
            onStageImage={record ? stageImage : undefined}
            assetUrls={assetUrls}
            label="Obsah článku"
          />
          {!record && <p className="field-help">Vložené obrázky budou dostupné po prvním uložení konceptu.</p>}
        </div>
        <StatusMessage kind={messageKind}>{message}</StatusMessage>
        {conflict && <button type="button" className="button button--secondary" onClick={load}>Načíst aktuální verzi</button>}
        <div className="admin-editor-actions">
          {status.kind === 'draft' && (
            <>
              <button type="button" className="button button--secondary" disabled={busy} onClick={() => save(false)}>Uložit koncept</button>
              <button type="button" className="button button--primary" disabled={busy} onClick={() => save(true)}>Publikovat</button>
            </>
          )}
          {status.kind === 'published' && (
            <>
              <button type="button" className="button button--primary" disabled={busy} onClick={() => save(true)}>Uložit změny</button>
              <button type="button" className="button button--secondary" disabled={busy} onClick={() => save(false)}>Skrýt</button>
            </>
          )}
          {status.kind === 'warning' && (
            <>
              <button type="button" className="button button--secondary" disabled={busy} onClick={() => save(false)}>Uložit změny</button>
              <button type="button" className="button button--primary" disabled={busy} onClick={() => save(true)}>Znovu publikovat</button>
            </>
          )}
          {record && <button type="button" className="button button--danger" disabled={busy} onClick={() => setDeleteOpen(true)}>Trvale smazat</button>}
        </div>
      </div>

      <Dialog open={deleteOpen} title="Trvale smazat článek?" onClose={() => setDeleteOpen(false)}>
        <p>Smaže se článek, historie jeho adres i vložené obrázky. Tuto akci nelze vrátit.</p>
        <div className="dialog-actions">
          <button data-dialog-initial type="button" className="button button--secondary" onClick={() => setDeleteOpen(false)}>Zrušit</button>
          <button type="button" className="button button--danger" disabled={busy} onClick={deletePost}>Trvale smazat</button>
        </div>
      </Dialog>
      <ReauthenticationDialog
        open={reauthOpen}
        email={api.ownerEmail()}
        authenticate={api.reauthenticate}
        onSuccess={() => { setReauthOpen(false); setMessageKind('success'); setMessage('Přihlášení bylo obnoveno. Původní akci teď vědomě zopakuj.') }}
        onCancel={() => setReauthOpen(false)}
      />
      <UnsavedChangesDialog open={Boolean(guard.pendingLocation)} onStay={guard.stay} onDiscard={guard.discardAndLeave} />
    </AdminFrame>
  )
}
