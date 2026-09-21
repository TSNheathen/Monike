import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { createBlogRoute } from '../api/blog-route.js'
import { createRobotsRoute } from '../api/robots.js'
import { createSitemapRoute } from '../api/sitemap.js'
import { htmlResponse, runtimeEnvironment } from '../api/_lib/http.js'
import { securityHeaders } from './security-headers.js'
import { proxyPocketBase } from './pocketbase-proxy.js'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
}
const PAGE_PATHS = new Set(['/', '/gallery', '/blog', '/o-mne', '/kontakt', '/admin'])

export function createAppServer({ environment = process.env, distDir = path.resolve('dist'), fetchImpl = fetch, loadHtml } = {}) {
  const configuration = runtimeEnvironment(environment)
  const headers = securityHeaders(environment)
  const html = loadHtml || ((name) => readFile(path.join(distDir, name), 'utf8'))
  const blog = createBlogRoute({ environment, fetchImpl, loadHtml: html })
  const sitemap = createSitemapRoute({ environment, fetchImpl })
  const robots = createRobotsRoute({ environment })

  async function respond(request, response) {
    const url = new URL(request.url, configuration.siteOrigin)
    if (url.pathname.startsWith('/api/') || url.pathname === '/_' || url.pathname.startsWith('/_/')) {
      if (configuration.noindex) response.setHeader('X-Robots-Tag', 'noindex,nofollow')
      return proxyPocketBase(request, response, {
        target: configuration.pocketBaseInternalOrigin,
        trustProxy: environment.MONIKE_TRUST_PROXY === 'true',
      })
    }
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value)
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' })
      return response.end()
    }
    let result
    const article = url.pathname.match(/^\/blog\/([^/]+)$/)
    if (article) {
      result = await blog(new Request(`${configuration.siteOrigin}/blog?slug=${encodeURIComponent(article[1])}`))
    } else if (url.pathname === '/robots.txt') result = robots()
    else if (url.pathname === '/sitemap.xml') result = await sitemap()
    else if (PAGE_PATHS.has(url.pathname) || url.pathname.startsWith('/admin/')) {
      result = htmlResponse(await html('index.html'), 200, configuration)
    } else {
      let filename
      try {
        const decoded = decodeURIComponent(url.pathname)
        if (!decoded.split(/[\\/]/).some((part) => part.startsWith('.')) && !decoded.includes('\0')) {
          const candidate = path.resolve(distDir, `.${decoded}`)
          if (candidate.startsWith(`${path.resolve(distDir)}${path.sep}`)) filename = candidate
        }
      } catch { /* Invalid encoded paths are regular 404 responses. */ }
      const file = filename ? await stat(filename).catch(() => null) : null
      if (file?.isFile() && MIME[path.extname(filename).toLowerCase()]) {
        response.writeHead(200, {
          'Content-Type': MIME[path.extname(filename).toLowerCase()],
          'Content-Length': file.size,
          'Cache-Control': /\/assets\/[^/]+-[\w-]{8,}\.(js|css)$/.test(url.pathname)
            ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
        })
        if (request.method === 'HEAD') return response.end()
        const stream = createReadStream(filename)
        stream.on('error', () => response.destroy())
        response.on('close', () => stream.destroy())
        return stream.pipe(response)
      }
      result = htmlResponse(await html('404.html'), 404, configuration)
    }
    response.statusCode = result.status
    result.headers.forEach((value, name) => response.setHeader(name, value))
    response.end(request.method === 'HEAD' ? undefined : Buffer.from(await result.arrayBuffer()))
  }

  return createServer((request, response) => {
    respond(request, response).catch(() => {
      if (response.headersSent) return response.destroy()
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60' })
      response.end('Web teď není dostupný.')
    })
  })
}
