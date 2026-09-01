import { APP_ENVIRONMENT, SITE_ORIGIN } from '../config/environment.js'

export const DEFAULT_SOCIAL_IMAGE_PATH = '/assets/landing/background-desktop.png'

export function absoluteSiteUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) return new URL(path).toString()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new URL(normalizedPath, `${SITE_ORIGIN}/`).toString()
}

export function pageMetadata({
  title,
  description,
  path,
  canonical = true,
  robots = 'index,follow',
  type = 'website',
  image = DEFAULT_SOCIAL_IMAGE_PATH,
  publishedTime = null,
}) {
  return Object.freeze({
    title,
    description,
    canonicalUrl: canonical ? absoluteSiteUrl(path) : null,
    robots: APP_ENVIRONMENT === 'demo' ? 'noindex,nofollow' : robots,
    type,
    imageUrl: image ? absoluteSiteUrl(image) : null,
    locale: 'cs_CZ',
    publishedTime,
  })
}

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.append(element)
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value))
}

export function applyPageMetadata(metadata) {
  document.title = metadata.title
  upsertMeta('meta[name="description"]', { name: 'description', content: metadata.description })
  upsertMeta('meta[name="robots"]', { name: 'robots', content: metadata.robots })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: metadata.title })
  upsertMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: metadata.description,
  })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: metadata.type })
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: metadata.locale })
  upsertMeta('meta[name="twitter:card"]', {
    name: 'twitter:card',
    content: 'summary_large_image',
  })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: metadata.title })
  upsertMeta('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: metadata.description,
  })

  const optional = [
    ['meta[property="og:url"]', 'property', 'og:url', metadata.canonicalUrl],
    ['meta[property="og:image"]', 'property', 'og:image', metadata.imageUrl],
    ['meta[name="twitter:image"]', 'name', 'twitter:image', metadata.imageUrl],
    ['meta[property="article:published_time"]', 'property', 'article:published_time', metadata.publishedTime],
  ]
  optional.forEach(([selector, key, name, value]) => {
    const current = document.head.querySelector(selector)
    if (!value) current?.remove()
    else upsertMeta(selector, { [key]: name, content: value })
  })

  let canonical = document.head.querySelector('link[rel="canonical"]')
  if (!metadata.canonicalUrl) canonical?.remove()
  else {
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    canonical.href = metadata.canonicalUrl
  }
}
