import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const DEFAULT_DESCRIPTION = 'Článek z osobního blogu Moniké.'

export function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function xmlEscape(value) {
  return htmlEscape(value)
}

export function runtimeEnvironment(environment = process.env) {
  const name = environment.MONIKE_ENV || environment.VITE_APP_ENV || 'production'
  if (!['demo', 'production', 'test'].includes(name)) {
    throw new Error(`Neplatné serverové prostředí Moniké: ${name}`)
  }
  const pocketBaseUrl = environment.MONIKE_POCKETBASE_URL || environment.VITE_POCKETBASE_URL
  const siteUrl = environment.MONIKE_SITE_URL || environment.VITE_SITE_URL
  if (!pocketBaseUrl || !siteUrl) throw new Error('Chybí veřejná PocketBase nebo webová URL.')
  return {
    name,
    pocketBaseOrigin: new URL(pocketBaseUrl).origin,
    siteOrigin: new URL(siteUrl).origin,
    noindex: name !== 'production',
  }
}

export async function loadStaticHtml(filename, reader = readFile) {
  const candidates = [
    path.join(process.cwd(), 'dist', filename),
    path.join(process.cwd(), 'public', filename),
  ]
  let lastError
  for (const candidate of candidates) {
    try {
      return await reader(candidate, 'utf8')
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

function replaceMeta(html, selectorName, value) {
  const escaped = htmlEscape(value)
  const expression = new RegExp(`<meta\\s+name=["']${selectorName}["'][^>]*>`, 'i')
  const tag = `<meta name="${selectorName}" content="${escaped}">`
  return expression.test(html) ? html.replace(expression, tag) : html.replace('</head>', `  ${tag}\n</head>`)
}

export function articleHtml(shell, record, configuration) {
  const title = `${record.title.trim()} | Moniké`
  const description = record.excerpt?.trim() || DEFAULT_DESCRIPTION
  const canonicalUrl = new URL(`/blog/${record.slug}`, `${configuration.siteOrigin}/`).toString()
  const imageUrl = record.cover_image
    ? `${configuration.pocketBaseOrigin}/api/files/posts/${encodeURIComponent(record.id)}/${encodeURIComponent(record.cover_image)}?thumb=1200x630`
    : new URL('/assets/landing/background-desktop.png', `${configuration.siteOrigin}/`).toString()
  const robots = configuration.noindex ? 'noindex,nofollow' : 'index,follow'
  const metadata = [
    `<link rel="canonical" href="${htmlEscape(canonicalUrl)}">`,
    `<meta property="og:title" content="${htmlEscape(title)}">`,
    `<meta property="og:description" content="${htmlEscape(description)}">`,
    '<meta property="og:type" content="article">',
    '<meta property="og:locale" content="cs_CZ">',
    `<meta property="og:url" content="${htmlEscape(canonicalUrl)}">`,
    `<meta property="og:image" content="${htmlEscape(imageUrl)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${htmlEscape(title)}">`,
    `<meta name="twitter:description" content="${htmlEscape(description)}">`,
    `<meta name="twitter:image" content="${htmlEscape(imageUrl)}">`,
    ...(record.published_at
      ? [`<meta property="article:published_time" content="${htmlEscape(record.published_at)}">`]
      : []),
  ].join('\n    ')

  let output = shell.replace(/<title>[\s\S]*?<\/title>/i, `<title>${htmlEscape(title)}</title>`)
  output = replaceMeta(output, 'description', description)
  output = replaceMeta(output, 'robots', robots)
  return output.replace('</head>', `    ${metadata}\n  </head>`)
}

export function validCanonicalRecord(record, requestedSlug) {
  return Boolean(
    record &&
    typeof record.id === 'string' && /^[a-z0-9]{15}$/.test(record.id) &&
    typeof record.title === 'string' && record.title.trim() &&
    record.slug === requestedSlug &&
    record.published === true &&
    typeof record.published_at === 'string' && !Number.isNaN(Date.parse(record.published_at)) &&
    Array.isArray(record.categories) && record.categories.length >= 1,
  )
}

export function responseHeaders(configuration, extra = {}) {
  return {
    'Cache-Control': 'no-store',
    ...(configuration.noindex ? { 'X-Robots-Tag': 'noindex,nofollow' } : {}),
    ...extra,
  }
}

export function htmlResponse(html, status, configuration, extra = {}) {
  return new Response(html, {
    status,
    headers: responseHeaders(configuration, {
      'Content-Type': 'text/html; charset=utf-8',
      ...extra,
    }),
  })
}
