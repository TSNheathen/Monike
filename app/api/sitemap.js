import { responseHeaders, runtimeEnvironment, xmlEscape } from './_lib/http.js'

const STATIC_PATHS = ['/', '/gallery', '/blog', '/o-mne', '/kontakt']

export function createSitemapRoute({ fetchImpl = fetch, environment = process.env, timeoutMs = 3000 } = {}) {
  return async function sitemapRoute() {
    let configuration
    try {
      configuration = runtimeEnvironment(environment)
    } catch {
      return new Response('Sitemap teď není dostupná.', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } })
    }
    if (configuration.name !== 'production') {
      return new Response('Sitemap není v tomto prostředí veřejná.', {
        status: 404,
        headers: responseHeaders(configuration, { 'Content-Type': 'text/plain; charset=utf-8' }),
      })
    }

    const posts = []
    try {
      let page = 1
      let totalPages = 1
      do {
        const query = new URLSearchParams({
          page: String(page),
          perPage: '500',
          sort: '-published_at,-created',
          filter: 'published = true && labels:length > 0',
        })
        const response = await fetchImpl(
          `${configuration.pocketBaseInternalOrigin}/api/collections/posts/records?${query}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) },
        )
        if (!response.ok) throw new Error('PocketBase sitemap query failed.')
        const data = await response.json()
        if (!data || !Array.isArray(data.items)) throw new Error('PocketBase sitemap response is invalid.')
        totalPages = Number(data.totalPages || 1)
        if (!Number.isSafeInteger(totalPages) || totalPages < page || totalPages > 100) {
          throw new Error('PocketBase sitemap pagination is invalid.')
        }
        posts.push(...data.items)
        page += 1
      } while (page <= totalPages)
    } catch {
      return new Response('Sitemap teď není dostupná.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
      })
    }
    const slugs = posts
      .filter((post) => post.published === true && Array.isArray(post.labels) && post.labels.length > 0)
      .map((post) => post.slug)
    if (slugs.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
      return new Response('Sitemap teď není dostupná.', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } })
    }
    const paths = [...STATIC_PATHS, ...[...new Set(slugs)].map((slug) => `/blog/${slug}`)]
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((pathname) => `  <url><loc>${xmlEscape(new URL(pathname, `${configuration.siteOrigin}/`).toString())}</loc></url>`).join('\n')}\n</urlset>\n`
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=300',
      },
    })
  }
}

const handler = createSitemapRoute()
export function GET() {
  return handler()
}
