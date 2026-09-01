// @vitest-environment node
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { once } from 'node:events'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBlogRoute } from '../../api/blog-route.js'
import { createRobotsRoute } from '../../api/robots.js'
import { createSitemapRoute } from '../../api/sitemap.js'
import proxy, { securityHeaders } from '../../proxy.js'

const production = {
  MONIKE_ENV: 'production',
  MONIKE_POCKETBASE_URL: 'https://pb.example.test',
  MONIKE_SITE_URL: 'https://monike.example',
}

const demo = { ...production, MONIKE_ENV: 'demo', MONIKE_SITE_URL: 'https://demo.monike.example' }

const publishedRecord = {
  id: 'abc123def456ghi',
  slug: 'zlaty-pribeh',
  title: 'Zlatý příběh </title><script>alert(1)</script>',
  excerpt: 'Vzpomínka & cesta <domů>',
  published: true,
  published_at: '2026-08-30 10:00:00.000Z',
  categories: ['vzpominky'],
  cover_image: 'cover image.jpg',
}

async function staticHtml(filename) {
  const source = filename === 'index.html' ? 'index.html' : path.join('public', filename)
  return readFile(path.resolve(process.cwd(), source), 'utf8')
}

function resolverFetch(url) {
  const pathname = new URL(url).pathname
  const slug = decodeURIComponent(pathname.split('/').at(-1))
  if (slug === publishedRecord.slug) {
    return Promise.resolve(Response.json({ kind: 'canonical', record: publishedRecord }))
  }
  if (slug === 'stary-pribeh') {
    return Promise.resolve(Response.json({ kind: 'alias', location: '/blog/zlaty-pribeh' }))
  }
  if (slug === 'chybi') return Promise.resolve(new Response(null, { status: 404 }))
  if (slug === 'porucha') return Promise.resolve(new Response(null, { status: 500 }))
  if (slug === 'spatna-odpoved') return Promise.resolve(Response.json({ kind: 'mystery' }))
  return Promise.reject(new Error('Backend unavailable'))
}

const openServers = new Set()

afterEach(async () => {
  await Promise.all([...openServers].map((server) => new Promise((resolve) => server.close(resolve))))
  openServers.clear()
})

async function startVercelLikeServer({ environment = production } = {}) {
  const blogRoute = createBlogRoute({ fetchImpl: resolverFetch, loadHtml: staticHtml, environment })
  const sitemapRoute = createSitemapRoute({
    environment,
    fetchImpl: async () => Response.json({
      page: 1,
      perPage: 500,
      totalPages: 1,
      items: [publishedRecord],
    }),
  })
  const robotsRoute = createRobotsRoute({ environment })
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host}`)
      let result
      const articleMatch = requestUrl.pathname.match(/^\/blog\/([^/]+)$/)
      if (articleMatch) {
        result = await blogRoute(new Request(
          `${requestUrl.origin}/api/blog-route?slug=${encodeURIComponent(articleMatch[1])}`,
        ))
      } else if (requestUrl.pathname === '/sitemap.xml') {
        result = await sitemapRoute()
      } else if (requestUrl.pathname === '/robots.txt') {
        result = robotsRoute()
      } else if (['/', '/gallery', '/blog', '/o-mne', '/kontakt'].includes(requestUrl.pathname) || requestUrl.pathname.startsWith('/admin/')) {
        result = new Response(await staticHtml('index.html'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      } else {
        result = new Response(await staticHtml('404.html'), {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }
      response.statusCode = result.status
      result.headers.forEach((value, name) => response.setHeader(name, value))
      response.end(Buffer.from(await result.arrayBuffer()))
    } catch {
      response.statusCode = 500
      response.end('test adapter failure')
    }
  })
  openServers.add(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}

describe('Vercel-like HTTP routing contract', () => {
  it('serves a canonical article with escaped initial SEO metadata', async () => {
    const origin = await startVercelLikeServer()
    const response = await fetch(`${origin}/blog/zlaty-pribeh`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(html).toContain('<title>Zlatý příběh &lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt; | Moniké</title>')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('<meta name="description" content="Vzpomínka &amp; cesta &lt;domů&gt;">')
    expect(html).toContain('<link rel="canonical" href="https://monike.example/blog/zlaty-pribeh">')
    expect(html).toContain('<meta property="og:type" content="article">')
    expect(html).toContain('<meta property="og:url" content="https://monike.example/blog/zlaty-pribeh">')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(html).toContain('https://pb.example.test/api/files/posts/abc123def456ghi/cover%20image.jpg?thumb=1200x630')
  })

  it('returns an absolute 308 for aliases and authoritative 404 for missing articles', async () => {
    const origin = await startVercelLikeServer()
    const alias = await fetch(`${origin}/blog/stary-pribeh`, { redirect: 'manual' })
    const missing = await fetch(`${origin}/blog/chybi`)

    expect(alias.status).toBe(308)
    expect(alias.headers.get('location')).toBe('https://monike.example/blog/zlaty-pribeh')
    expect(missing.status).toBe(404)
    expect(await missing.text()).toContain('Tahle cesta nikam nevede')
  })

  it.each(['porucha', 'spatna-odpoved', 'bez-spojeni'])(
    'returns a non-cacheable 503 when resolution is not authoritative: %s',
    async (slug) => {
      const origin = await startVercelLikeServer()
      const response = await fetch(`${origin}/blog/${slug}`)
      expect(response.status).toBe(503)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('retry-after')).toBe('60')
      expect(await response.text()).toContain('Moniké si dává krátkou pauzu')
    },
  )

  it('keeps known SPA paths and gives an unknown path a real HTTP 404', async () => {
    const origin = await startVercelLikeServer()
    const known = await fetch(`${origin}/o-mne`)
    const unknown = await fetch(`${origin}/opravdu-neznam`)

    expect(known.status).toBe(200)
    expect(unknown.status).toBe(404)
    expect(await unknown.text()).toContain('<meta name="robots" content="noindex,follow">')
  })

  it('publishes canonical production URLs in sitemap and environment-specific robots', async () => {
    const origin = await startVercelLikeServer()
    const sitemap = await fetch(`${origin}/sitemap.xml`)
    const xml = await sitemap.text()
    const robots = await fetch(`${origin}/robots.txt`)

    expect(sitemap.status).toBe(200)
    expect(sitemap.headers.get('cache-control')).toContain('s-maxage=3600')
    expect(xml).toContain('<loc>https://monike.example/blog/zlaty-pribeh</loc>')
    expect(xml).not.toContain('/admin')
    expect(await robots.text()).toContain('Disallow: /admin/')

    const demoOrigin = await startVercelLikeServer({ environment: demo })
    const demoRobots = await fetch(`${demoOrigin}/robots.txt`)
    const demoArticle = await fetch(`${demoOrigin}/blog/zlaty-pribeh`)
    const demoSitemap = await fetch(`${demoOrigin}/sitemap.xml`)
    expect(await demoRobots.text()).toBe('User-agent: *\nDisallow: /\n')
    expect(demoRobots.headers.get('x-robots-tag')).toBe('noindex,nofollow')
    expect(demoArticle.headers.get('x-robots-tag')).toBe('noindex,nofollow')
    expect(await demoArticle.text()).toContain('<meta name="robots" content="noindex,nofollow">')
    expect(demoSitemap.status).toBe(404)
  })
})

describe('Vercel configuration', () => {
  it('routes only explicit SPA families and runs article resolution first in fra1', async () => {
    const config = JSON.parse(await readFile(path.resolve(process.cwd(), 'vercel.json'), 'utf8'))
    const sources = config.rewrites.map((rewrite) => rewrite.source)

    expect(config.functions['api/blog-route.js'].regions).toEqual(['fra1'])
    expect(config.functions['api/blog-route.js'].includeFiles).toBe(
      '{dist/index.html,public/404.html,public/503.html}',
    )
    expect(config.rewrites[0]).toEqual({
      source: '/blog/:slug',
      destination: '/api/blog-route?slug=:slug',
    })
    expect(sources).not.toContain('/(.*)')
    expect(sources).not.toContain('/:path*')
    expect(sources).toEqual(expect.arrayContaining([
      '/', '/gallery', '/blog', '/o-mne', '/kontakt', '/admin/:path*',
    ]))
  })

  it('adds a global noindex response header outside production', () => {
    const previousMonikeEnvironment = process.env.MONIKE_ENV
    const previousPocketBase = process.env.MONIKE_POCKETBASE_URL
    process.env.MONIKE_ENV = 'demo'
    process.env.MONIKE_POCKETBASE_URL = 'https://api-demo.monike.example'
    try {
      const response = proxy()
      expect(response.headers.get('x-middleware-next')).toBe('1')
      expect(response.headers.get('x-robots-tag')).toBe('noindex,nofollow')
    } finally {
      if (previousMonikeEnvironment === undefined) delete process.env.MONIKE_ENV
      else process.env.MONIKE_ENV = previousMonikeEnvironment
      if (previousPocketBase === undefined) delete process.env.MONIKE_POCKETBASE_URL
      else process.env.MONIKE_POCKETBASE_URL = previousPocketBase
    }
  })

  it('emits the strict script, framing and browser policy headers with only the configured API origin', () => {
    const headers = securityHeaders({
      MONIKE_ENV: 'production',
      MONIKE_POCKETBASE_URL: 'https://api.monike.example/path-is-ignored',
    })
    expect(headers['Content-Security-Policy']).toContain("script-src 'self'; script-src-attr 'none'")
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(headers['Content-Security-Policy']).toContain("connect-src 'self' https://api.monike.example")
    expect(headers['Content-Security-Policy']).not.toContain('unsafe-eval')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Permissions-Policy']).toContain('camera=()')
    expect(headers['Strict-Transport-Security']).toBe('max-age=300')
  })

  it('povolí roční HSTS s includeSubDomains až explicitně po stabilizaci DNS', () => {
    const headers = securityHeaders({
      MONIKE_ENV: 'production',
      MONIKE_POCKETBASE_URL: 'https://api.monike.example',
      MONIKE_HSTS_MAX_AGE: '31536000',
      MONIKE_HSTS_INCLUDE_SUBDOMAINS: 'true',
    })
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains')
    expect(() => securityHeaders({
      MONIKE_ENV: 'production',
      MONIKE_POCKETBASE_URL: 'https://api.monike.example',
      MONIKE_HSTS_MAX_AGE: '300',
      MONIKE_HSTS_INCLUDE_SUBDOMAINS: 'true',
    })).toThrow()
  })

  it('fails security-header configuration closed for HTTP, credentials or unknown environments', () => {
    expect(() => securityHeaders({ MONIKE_ENV: 'production', MONIKE_POCKETBASE_URL: 'http://api.example' })).toThrow()
    expect(() => securityHeaders({ MONIKE_ENV: 'production', MONIKE_POCKETBASE_URL: 'https://user:pass@api.example' })).toThrow()
    expect(() => securityHeaders({ MONIKE_ENV: 'preview', MONIKE_POCKETBASE_URL: 'https://api.example' })).toThrow()
  })

  it('fails the production sitemap closed when PocketBase is unavailable', async () => {
    const handler = createSitemapRoute({
      environment: production,
      fetchImpl: async () => new Response(null, { status: 500 }),
    })
    const response = await handler()
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('retry-after')).toBe('60')
  })
})
