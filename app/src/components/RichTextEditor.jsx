import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Dialog } from './Dialog.jsx'
import { createMonikeEditorKeys } from '../extensions/MonikeEditorKeys.js'
import { createMonikeImageExtension } from '../extensions/MonikeImage.js'
import {
  EMPTY_RICH_TEXT,
  isAllowedHref,
  normalizeHref,
  normalizePastedHtml,
} from '../lib/rich-text-client.js'
import { normalizeAdminImage } from '../lib/image-normalization.js'

const EMPTY_IMAGE = {
  alt: '',
  widthPercent: 100,
  align: 'center',
  wrap: 'none',
  file: null,
}
const EMPTY_ASSET_URLS = Object.freeze({})

function ToolbarButton({ active = false, children, ...props }) {
  return (
    <button type="button" aria-pressed={active} {...props}>
      {children}
    </button>
  )
}

export default function RichTextEditor({
  value = EMPTY_RICH_TEXT,
  onChange,
  onStageImage,
  assetUrls = EMPTY_ASSET_URLS,
  label = 'Obsah',
}) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [linkError, setLinkError] = useState('')
  const [imageOpen, setImageOpen] = useState(false)
  const [imageForm, setImageForm] = useState(EMPTY_IMAGE)
  const [imageError, setImageError] = useState('')
  const [imageSaving, setImageSaving] = useState(false)
  const [localAssetUrls, setLocalAssetUrls] = useState(assetUrls)
  const assetUrlsRef = useRef(assetUrls)
  const editorRef = useRef(null)
  const linkInputRef = useRef(null)
  const imageAltRef = useRef(null)
  const editorId = useId()
  const imageStatusId = useId()

  useEffect(() => {
    setLocalAssetUrls((current) => ({ ...current, ...assetUrls }))
  }, [assetUrls])
  useEffect(() => {
    assetUrlsRef.current = localAssetUrls
  }, [localAssetUrls])

  const openLink = useCallback(() => {
    setLinkValue(editorRef.current?.getAttributes('link').href || '')
    setLinkError('')
    setLinkOpen(true)
  }, [])

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        strike: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        HTMLAttributes: { target: null, rel: null },
        validate: isAllowedHref,
      }),
      createMonikeImageExtension((assetId) => assetUrlsRef.current[assetId] || ''),
      createMonikeEditorKeys(openLink),
    ],
    [openLink],
  )

  const editor = useEditor({
    extensions,
    content: value,
    editorProps: {
      attributes: {
        'aria-label': label,
        role: 'textbox',
      },
      transformPastedHTML: normalizePastedHtml,
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getJSON())
    },
  })
  editorRef.current = editor

  useEffect(() => {
    if (!editor || JSON.stringify(editor.getJSON()) === JSON.stringify(value)) return
    editor.commands.setContent(value || EMPTY_RICH_TEXT, false)
  }, [editor, value])

  function showLinkDialog() {
    setLinkValue(editor?.getAttributes('link').href || '')
    setLinkError('')
    setLinkOpen(true)
  }

  function applyLink(event) {
    event.preventDefault()
    const href = normalizeHref(linkValue)
    if (!href) {
      setLinkError('Použij adresu https://, http://, mailto: nebo cestu začínající /.')
      return
    }
    editor?.chain().focus().extendMarkRange('link').setLink({ href }).run()
    setLinkOpen(false)
  }

  function removeLink() {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run()
    setLinkOpen(false)
  }

  function showImageDialog() {
    const editing = editor?.isActive('monikeImage')
    const attrs = editing ? editor.getAttributes('monikeImage') : EMPTY_IMAGE
    setImageForm({
      alt: attrs.alt || '',
      widthPercent: Number(attrs.widthPercent) || 100,
      align: attrs.align || 'center',
      wrap: attrs.wrap || 'none',
      file: null,
    })
    setImageError('')
    setImageOpen(true)
  }

  async function applyImage(event) {
    event.preventDefault()
    const alt = imageForm.alt.trim()
    if (!alt || alt.length > 220) {
      setImageError('Alternativní text je povinný a smí mít nejvýše 220 znaků.')
      return
    }

    const currentAttrs = editor?.isActive('monikeImage')
      ? editor.getAttributes('monikeImage')
      : null
    if (!currentAttrs && !imageForm.file) {
      setImageError('Vyber obrázek k nahrání.')
      return
    }
    if (imageForm.file && !onStageImage) {
      setImageError('Nejdřív obsah jednou ulož, potom můžeš vložit obrázek.')
      return
    }

    setImageSaving(true)
    setImageError('')
    try {
      let assetId = currentAttrs?.assetId
      if (imageForm.file) {
        const normalized = await normalizeAdminImage(imageForm.file, { maxBytes: 10 * 1024 * 1024 })
        const staged = await onStageImage(normalized)
        assetId = staged.id
        if (staged.imageUrl) {
          const nextUrls = { ...assetUrlsRef.current, [assetId]: staged.imageUrl }
          assetUrlsRef.current = nextUrls
          setLocalAssetUrls(nextUrls)
        }
      }
      const attrs = {
        assetId,
        alt,
        widthPercent: Number(imageForm.widthPercent),
        align: imageForm.align,
        wrap: imageForm.wrap,
      }
      if (currentAttrs) editor.chain().focus().updateAttributes('monikeImage', attrs).run()
      else editor.chain().focus().insertContent({ type: 'monikeImage', attrs }).run()
      setImageOpen(false)
    } catch (error) {
      setImageError(error?.message || 'Obrázek se nepodařilo nahrát.')
    } finally {
      setImageSaving(false)
    }
  }

  function removeImage() {
    editor?.chain().focus().deleteSelection().run()
    setImageOpen(false)
  }

  function handleToolbarKeyDown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const controls = [...event.currentTarget.querySelectorAll('button:not([disabled])')]
    const currentIndex = controls.indexOf(document.activeElement)
    if (currentIndex < 0 || controls.length === 0) return
    event.preventDefault()
    let nextIndex = currentIndex
    if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = controls.length - 1
    else if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % controls.length
    else nextIndex = (currentIndex - 1 + controls.length) % controls.length
    controls[nextIndex].focus()
  }

  return (
    <div className="editor-shell">
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label="Nástroje editoru"
        aria-controls={editorId}
        onKeyDown={handleToolbarKeyDown}
      >
        <div className="editor-toolbar__group" aria-label="Blok">
          <ToolbarButton active={editor?.isActive('paragraph')} onClick={() => editor?.chain().focus().setParagraph().run()}>
            Odstavec
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            Nadpis 2
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('heading', { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
            Nadpis 3
          </ToolbarButton>
        </div>
        <div className="editor-toolbar__group" aria-label="Text">
          <ToolbarButton active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
            Tučně
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            Kurzíva
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('link')} onClick={showLinkDialog}>Odkaz</ToolbarButton>
        </div>
        <div className="editor-toolbar__group" aria-label="Struktura">
          <ToolbarButton active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            Odrážkový seznam
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            Číslovaný seznam
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            Citace
          </ToolbarButton>
        </div>
        <div className="editor-toolbar__group" aria-label="Média">
          <ToolbarButton active={editor?.isActive('monikeImage')} onClick={showImageDialog}>Vložit obrázek</ToolbarButton>
        </div>
        <div className="editor-toolbar__group" aria-label="Historie">
          <ToolbarButton disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>Zpět</ToolbarButton>
          <ToolbarButton disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>Znovu</ToolbarButton>
        </div>
      </div>
      <EditorContent id={editorId} editor={editor} className="editor-content" />

      <Dialog open={linkOpen} title="Odkaz" onClose={() => setLinkOpen(false)} initialFocusRef={linkInputRef}>
        <form className="form-stack" onSubmit={applyLink}>
          <label className="field">
            <span>URL</span>
            <input ref={linkInputRef} value={linkValue} onChange={(event) => setLinkValue(event.target.value)} aria-invalid={Boolean(linkError)} aria-describedby={linkError ? 'editor-link-error' : undefined} />
          </label>
          {linkError && <p id="editor-link-error" className="status-message status-message--error" role="alert">{linkError}</p>}
          <div className="dialog-actions">
            {editor?.isActive('link') && <button type="button" className="button button--quiet" onClick={removeLink}>Odebrat odkaz</button>}
            <button type="button" className="button button--secondary" onClick={() => setLinkOpen(false)}>Zrušit</button>
            <button type="submit" className="button button--primary">Použít odkaz</button>
          </div>
        </form>
      </Dialog>

      <Dialog open={imageOpen} title={editor?.isActive('monikeImage') ? 'Upravit obrázek' : 'Vložit obrázek'} onClose={() => setImageOpen(false)} initialFocusRef={imageAltRef}>
        <form className="form-stack" onSubmit={applyImage}>
          <label className="field">
            <span>Soubor</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" aria-invalid={Boolean(imageError)} aria-describedby={imageError || imageForm.file || imageSaving ? imageStatusId : undefined} onChange={(event) => setImageForm({ ...imageForm, file: event.target.files?.[0] || null })} />
          </label>
          <label className="field">
            <span>Alternativní text</span>
            <input ref={imageAltRef} maxLength="220" required value={imageForm.alt} aria-invalid={Boolean(imageError && !imageForm.alt.trim())} aria-describedby={imageError ? imageStatusId : undefined} onChange={(event) => setImageForm({ ...imageForm, alt: event.target.value })} />
          </label>
          <label className="field">
            <span>Šířka v procentech</span>
            <input type="number" min="20" max="100" step="1" required value={imageForm.widthPercent} onChange={(event) => setImageForm({ ...imageForm, widthPercent: event.target.value })} />
          </label>
          <label className="field">
            <span>Zarovnání</span>
            <select value={imageForm.align} onChange={(event) => setImageForm({ ...imageForm, align: event.target.value })}>
              <option value="left">Vlevo</option>
              <option value="center">Na střed</option>
              <option value="right">Vpravo</option>
            </select>
          </label>
          <label className="field">
            <span>Obtékání textem</span>
            <select value={imageForm.wrap} onChange={(event) => setImageForm({ ...imageForm, wrap: event.target.value })}>
              <option value="none">Bez obtékání</option>
              <option value="left">Obtékat zprava</option>
              <option value="right">Obtékat zleva</option>
            </select>
          </label>
          <div id={imageStatusId}>
            {imageSaving && <p className="status-message" role="status">Nahrávám obrázek…</p>}
            {!imageSaving && imageForm.file && !imageError && <p className="field-help">Vybraný soubor: {imageForm.file.name}</p>}
            {imageError && <p className="status-message status-message--error" role="alert">{imageError}</p>}
          </div>
          <div className="dialog-actions">
            {editor?.isActive('monikeImage') && <button type="button" className="button button--quiet" onClick={removeImage}>Odebrat obrázek</button>}
            <button type="button" className="button button--secondary" onClick={() => setImageOpen(false)}>Zrušit</button>
            <button type="submit" className="button button--primary" disabled={imageSaving}>{imageSaving ? 'Nahrávám…' : 'Použít obrázek'}</button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
