const ABSOLUTE_HTTP = /^https?:\/\/(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::([0-9]{1,5}))?(?:[/?#].*)?$/i
const MAILTO = /^mailto:[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i
const BARE_HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::[0-9]{1,5})?(?:[/?#].*)?$/i

export const EMPTY_RICH_TEXT = Object.freeze({
  type: 'doc',
  content: [{ type: 'paragraph' }],
})

export function isAllowedHref(href) {
  if (typeof href !== 'string' || href.length === 0 || href.length > 2048) return false
  if (/[\u0000-\u0020\u007f\\<>"']/.test(href)) return false
  if (href.startsWith('/')) return !href.startsWith('//')
  if (MAILTO.test(href)) return true

  const match = href.match(ABSOLUTE_HTTP)
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

export function normalizeHref(value) {
  const href = typeof value === 'string' ? value.trim() : ''
  if (isAllowedHref(href)) return href
  if (BARE_HOST.test(href)) {
    const normalized = `https://${href}`
    return isAllowedHref(normalized) ? normalized : null
  }
  return null
}

function replaceTag(element, tagName) {
  const replacement = element.ownerDocument.createElement(tagName)
  while (element.firstChild) replacement.append(element.firstChild)
  element.replaceWith(replacement)
  return replacement
}

function unwrap(element) {
  const fragment = element.ownerDocument.createDocumentFragment()
  while (element.firstChild) fragment.append(element.firstChild)
  element.replaceWith(fragment)
}

function flattenTable(table) {
  const fragment = table.ownerDocument.createDocumentFragment()
  for (const row of table.querySelectorAll('tr')) {
    const text = [...row.querySelectorAll('th,td')]
      .map((cell) => cell.textContent.trim())
      .filter(Boolean)
      .join(' – ')
    if (!text) continue
    const paragraph = table.ownerDocument.createElement('p')
    paragraph.textContent = text
    fragment.append(paragraph)
  }
  table.replaceWith(fragment)
}

export function normalizePastedHtml(html) {
  if (typeof DOMParser === 'undefined') return ''
  const document = new DOMParser().parseFromString(String(html || ''), 'text/html')

  for (const node of document.body.querySelectorAll(
    'script,style,meta,link,img,picture,video,audio,iframe,object,embed,svg,canvas,hr',
  )) {
    node.remove()
  }
  for (const table of [...document.body.querySelectorAll('table')]) flattenTable(table)
  for (const pre of [...document.body.querySelectorAll('pre')]) {
    const paragraph = document.createElement('p')
    paragraph.textContent = pre.textContent
    pre.replaceWith(paragraph)
  }
  for (const code of [...document.body.querySelectorAll('code')]) {
    code.replaceWith(document.createTextNode(code.textContent))
  }

  for (const heading of [...document.body.querySelectorAll('h1')]) replaceTag(heading, 'h2')
  for (const heading of [...document.body.querySelectorAll('h4,h5,h6')]) replaceTag(heading, 'h3')

  // A third list level becomes readable inline text inside its second-level item.
  for (const list of [...document.body.querySelectorAll('ul,ol')].reverse()) {
    let depth = 0
    for (let parent = list.parentElement; parent; parent = parent.parentElement) {
      if (parent.matches('ul,ol')) depth += 1
    }
    if (depth < 2) continue
    const fragment = document.createDocumentFragment()
    for (const item of [...list.children].filter((child) => child.matches('li'))) {
      if (fragment.childNodes.length) fragment.append(document.createElement('br'))
      fragment.append(document.createTextNode(item.textContent.trim()))
    }
    list.replaceWith(fragment)
  }

  const allowed = new Set([
    'P', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'A', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'BR',
  ])
  for (const element of [...document.body.querySelectorAll('*')].reverse()) {
    if (!allowed.has(element.tagName)) {
      unwrap(element)
      continue
    }
    if (element.tagName === 'A') {
      const href = normalizeHref(element.getAttribute('href'))
      if (!href) {
        unwrap(element)
        continue
      }
      for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name)
      element.setAttribute('href', href)
      continue
    }
    for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name)
  }

  return document.body.innerHTML
}

export function listDepthAtSelection(state) {
  let depth = 0
  const { $from } = state.selection
  for (let index = 0; index <= $from.depth; index += 1) {
    if (['bulletList', 'orderedList'].includes($from.node(index).type.name)) depth += 1
  }
  return depth
}
