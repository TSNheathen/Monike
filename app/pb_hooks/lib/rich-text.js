'use strict'

const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'monikeImage',
]
const INLINE_TYPES = ['text', 'hardBreak']
const MARK_TYPES = ['bold', 'italic', 'link']
const ALIGNMENTS = ['left', 'center', 'right']
const WRAPS = ['none', 'left', 'right']

class RichTextValidationError extends Error {
  constructor(message, path, code) {
    super(message)
    this.name = 'RichTextValidationError'
    this.path = path || 'content_json'
    this.code = code || 'invalid_rich_text'
  }
}

function fail(message, path, code) {
  throw new RichTextValidationError(message, path, code)
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function assertKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`Nepovolená vlastnost ${key}.`, path)
  }
}

function assertContentArray(node, path, required) {
  if (node.content === undefined && !required) return []
  if (!Array.isArray(node.content)) fail('Obsah uzlu musí být pole.', `${path}.content`)
  if (required && node.content.length === 0) {
    fail('Obsah uzlu nesmí být prázdný.', `${path}.content`)
  }
  return node.content
}

function validateHref(href) {
  if (typeof href !== 'string' || href.length === 0 || href.length > 2048) return false
  if (/[\u0000-\u0020\u007f\\<>"']/.test(href)) return false

  if (href.startsWith('/')) return !href.startsWith('//')
  if (
    /^mailto:[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
      href,
    )
  ) {
    return true
  }

  const match = href.match(
    /^https?:\/\/(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::([0-9]{1,5}))?(?:[/?#].*)?$/i,
  )
  if (!match) return false
  const host = match[1]
  const port = match[2] ? Number(match[2]) : null
  if (port !== null && (port < 1 || port > 65535)) return false
  if (host.startsWith('[')) return host.includes(':')

  const labels = host.split('.')
  if (
    labels.some(
      (label) =>
        label.length < 1 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    )
  ) {
    return false
  }
  if (labels.length === 4 && labels.every((label) => /^\d+$/.test(label))) {
    return labels.every((label) => Number(label) <= 255)
  }
  return true
}

function validateMarks(marks, path) {
  if (marks === undefined) return []
  if (!Array.isArray(marks)) fail('Značky textu musí být pole.', path)

  const seen = new Set()
  for (let index = 0; index < marks.length; index += 1) {
    const mark = marks[index]
    const markPath = `${path}.${index}`
    if (!isPlainObject(mark)) fail('Neplatná značka textu.', markPath)
    assertKeys(mark, mark.type === 'link' ? ['type', 'attrs'] : ['type'], markPath)
    if (!MARK_TYPES.includes(mark.type) || seen.has(mark.type)) {
      fail('Nepovolená nebo duplicitní značka textu.', markPath)
    }
    seen.add(mark.type)

    if (mark.type === 'link') {
      if (!isPlainObject(mark.attrs)) fail('Odkaz nemá atributy.', `${markPath}.attrs`)
      assertKeys(mark.attrs, ['href'], `${markPath}.attrs`)
      if (!validateHref(mark.attrs.href)) {
        fail('Odkaz používá nepovolenou adresu.', `${markPath}.attrs.href`, 'invalid_link')
      }
    }
  }
  return marks
}

function validateInline(node, path, state) {
  if (!isPlainObject(node) || !INLINE_TYPES.includes(node.type)) {
    fail('Nepovolený řádkový uzel.', path)
  }

  if (node.type === 'hardBreak') {
    assertKeys(node, ['type'], path)
    return
  }

  assertKeys(node, ['type', 'text', 'marks'], path)
  if (typeof node.text !== 'string' || node.text.length === 0) {
    fail('Textový uzel musí obsahovat text.', `${path}.text`)
  }
  validateMarks(node.marks, `${path}.marks`)
  if (node.text.trim().length > 0) state.hasMeaningfulContent = true
}

function validateInlineContainer(node, path, state, allowedKeys) {
  assertKeys(node, allowedKeys, path)
  const content = assertContentArray(node, path, false)
  for (let index = 0; index < content.length; index += 1) {
    validateInline(content[index], `${path}.content.${index}`, state)
  }
}

function validateImage(node, path, state) {
  assertKeys(node, ['type', 'attrs'], path)
  if (!isPlainObject(node.attrs)) fail('Obrázek nemá atributy.', `${path}.attrs`)
  assertKeys(
    node.attrs,
    ['assetId', 'alt', 'widthPercent', 'align', 'wrap'],
    `${path}.attrs`,
  )

  const { assetId, alt, widthPercent, align, wrap } = node.attrs
  if (typeof assetId !== 'string' || !/^[a-z0-9]{15}$/.test(assetId)) {
    fail('Obrázek nemá platné assetId.', `${path}.attrs.assetId`, 'invalid_asset')
  }
  if (typeof alt !== 'string' || alt.trim().length === 0 || alt.length > 220) {
    fail('Obrázek musí mít alt text do 220 znaků.', `${path}.attrs.alt`)
  }
  if (!Number.isInteger(widthPercent) || widthPercent < 20 || widthPercent > 100) {
    fail('Šířka obrázku musí být celé číslo 20–100.', `${path}.attrs.widthPercent`)
  }
  if (!ALIGNMENTS.includes(align)) {
    fail('Neplatné zarovnání obrázku.', `${path}.attrs.align`)
  }
  if (!WRAPS.includes(wrap)) {
    fail('Neplatné obtékání obrázku.', `${path}.attrs.wrap`)
  }

  if (!state.assetIds.includes(assetId)) state.assetIds.push(assetId)
  state.hasMeaningfulContent = true
}

function validateBlock(node, path, state, listDepth) {
  if (!isPlainObject(node) || !BLOCK_TYPES.includes(node.type)) {
    fail('Nepovolený blokový uzel.', path)
  }

  if (node.type === 'paragraph') {
    validateInlineContainer(node, path, state, ['type', 'content'])
    return
  }

  if (node.type === 'heading') {
    validateInlineContainer(node, path, state, ['type', 'attrs', 'content'])
    if (!isPlainObject(node.attrs)) fail('Nadpis nemá atributy.', `${path}.attrs`)
    assertKeys(node.attrs, ['level'], `${path}.attrs`)
    if (node.attrs.level !== 2 && node.attrs.level !== 3) {
      fail('Povolené jsou pouze nadpisy H2 a H3.', `${path}.attrs.level`)
    }
    return
  }

  if (node.type === 'monikeImage') {
    validateImage(node, path, state)
    return
  }

  if (node.type === 'blockquote') {
    assertKeys(node, ['type', 'content'], path)
    const content = assertContentArray(node, path, true)
    for (let index = 0; index < content.length; index += 1) {
      validateBlock(content[index], `${path}.content.${index}`, state, listDepth)
    }
    return
  }

  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const nextDepth = listDepth + 1
    if (nextDepth > 2) fail('Seznam smí být vnořen nejvýše do druhé úrovně.', path)
    assertKeys(node, ['type', 'content'], path)
    const content = assertContentArray(node, path, true)
    for (let index = 0; index < content.length; index += 1) {
      const item = content[index]
      const itemPath = `${path}.content.${index}`
      if (!isPlainObject(item) || item.type !== 'listItem') {
        fail('Seznam smí obsahovat pouze položky seznamu.', itemPath)
      }
      assertKeys(item, ['type', 'content'], itemPath)
      const itemContent = assertContentArray(item, itemPath, true)
      if (itemContent[0].type !== 'paragraph') {
        fail('Položka seznamu musí začínat odstavcem.', `${itemPath}.content.0`)
      }
      for (let childIndex = 0; childIndex < itemContent.length; childIndex += 1) {
        validateBlock(
          itemContent[childIndex],
          `${itemPath}.content.${childIndex}`,
          state,
          nextDepth,
        )
      }
    }
  }
}

function validateDocument(document) {
  if (!isPlainObject(document)) fail('Dokument musí být objekt.', 'content_json')
  assertKeys(document, ['type', 'content'], 'content_json')
  if (document.type !== 'doc') fail('Kořen dokumentu musí být doc.', 'content_json.type')

  const state = { assetIds: [], hasMeaningfulContent: false }
  const content = assertContentArray(document, 'content_json', false)
  for (let index = 0; index < content.length; index += 1) {
    validateBlock(content[index], `content_json.content.${index}`, state, 0)
  }
  return state
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function serializeText(node) {
  const marks = validateMarks(node.marks, 'content_json.marks')
  let html = escapeHtml(node.text)
  const byType = {}
  for (const mark of marks) byType[mark.type] = mark
  if (byType.bold) html = `<strong>${html}</strong>`
  if (byType.italic) html = `<em>${html}</em>`
  if (byType.link) html = `<a href="${escapeHtml(byType.link.attrs.href)}">${html}</a>`
  return html
}

function serializeInline(content) {
  return (content || [])
    .map((node) => (node.type === 'hardBreak' ? '<br>' : serializeText(node)))
    .join('')
}

function assetUrl(baseUrl, asset, thumb) {
  const base = String(baseUrl || '').replace(/\/$/, '')
  const url = `${base}/api/files/content_assets/${encodeURIComponent(asset.id)}/${encodeURIComponent(asset.filename)}`
  return thumb ? `${url}?thumb=${encodeURIComponent(thumb)}` : url
}

function imageSizes(widthPercent) {
  const mobileOffset = Math.round(widthPercent * 0.64 * 100) / 100
  const desktopWidth = Math.round(widthPercent * 7.6 * 100) / 100
  return `(max-width: 759px) calc(${widthPercent}vw - ${mobileOffset}px), ${desktopWidth}px`
}

function serializeImage(node, options) {
  const attrs = node.attrs
  const asset = options.resolveAsset(attrs.assetId)
  if (!asset || !asset.id || !asset.filename) {
    fail('Odkazovaný obrázek neexistuje.', 'content_json', 'invalid_asset')
  }

  const naturalWidth = Number(asset.width) || 0
  const naturalHeight = Number(asset.height) || 0
  if (naturalWidth < 1 || naturalHeight < 1) {
    fail('Obrázek nemá ověřené rozměry.', 'content_json', 'invalid_asset')
  }

  const widths = [480, 800, 1200, 1600].filter((width) => width < naturalWidth)
  const srcset = widths
    .map((width) => `${assetUrl(options.assetBaseUrl, asset, `${width}x0`)} ${width}w`)
  srcset.push(`${assetUrl(options.assetBaseUrl, asset)} ${naturalWidth}w`)

  const srcWidth = widths.find((width) => width >= 800) || widths[0]
  const src = srcWidth
    ? assetUrl(options.assetBaseUrl, asset, `${srcWidth}x0`)
    : assetUrl(options.assetBaseUrl, asset)
  const classes = [
    'rich-text-image',
    `rich-text-image--width-${attrs.widthPercent}`,
    `rich-text-image--align-${attrs.align}`,
    `rich-text-image--wrap-${attrs.wrap}`,
  ].join(' ')

  return (
    `<figure class="${classes}" data-width-percent="${attrs.widthPercent}">` +
    `<img src="${escapeHtml(src)}" srcset="${escapeHtml(srcset.join(', '))}" ` +
    `sizes="${escapeHtml(imageSizes(attrs.widthPercent))}" ` +
    `width="${naturalWidth}" height="${naturalHeight}" ` +
    `loading="lazy" alt="${escapeHtml(attrs.alt)}">` +
    '</figure>'
  )
}

function serializeBlock(node, options) {
  if (node.type === 'paragraph') return `<p>${serializeInline(node.content)}</p>`
  if (node.type === 'heading') {
    return `<h${node.attrs.level}>${serializeInline(node.content)}</h${node.attrs.level}>`
  }
  if (node.type === 'blockquote') {
    return `<blockquote>${node.content.map((child) => serializeBlock(child, options)).join('')}</blockquote>`
  }
  if (node.type === 'monikeImage') return serializeImage(node, options)

  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const tag = node.type === 'bulletList' ? 'ul' : 'ol'
    const content = node.content
      .map(
        (item) =>
          `<li>${item.content.map((child) => serializeBlock(child, options)).join('')}</li>`,
      )
      .join('')
    return `<${tag}>${content}</${tag}>`
  }
  fail('Nepovolený blok při serializaci.', 'content_json')
}

function serializeDocument(document, options) {
  validateDocument(document)
  if (!options || typeof options.resolveAsset !== 'function') {
    options = { ...(options || {}), resolveAsset: () => null }
  }
  return (document.content || []).map((node) => serializeBlock(node, options)).join('')
}

module.exports = {
  RichTextValidationError,
  serializeDocument,
  validateDocument,
  validateHref,
}
