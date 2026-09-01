import { runtimeEnvironment } from './_lib/http.js'

export function createRobotsRoute({ environment = process.env } = {}) {
  return function robotsRoute() {
    let configuration
    try {
      configuration = runtimeEnvironment(environment)
    } catch {
      return new Response('User-agent: *\nDisallow: /\n', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    }
    const body = configuration.name === 'production'
      ? `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${configuration.siteOrigin}/sitemap.xml\n`
      : 'User-agent: *\nDisallow: /\n'
    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=3600',
        ...(configuration.noindex ? { 'X-Robots-Tag': 'noindex,nofollow' } : {}),
      },
    })
  }
}

const handler = createRobotsRoute()
export function GET() {
  return handler()
}
