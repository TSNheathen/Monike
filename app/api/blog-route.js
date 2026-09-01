import {
  articleHtml,
  htmlResponse,
  loadStaticHtml,
  responseHeaders,
  runtimeEnvironment,
  validCanonicalRecord,
} from './_lib/http.js'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function createBlogRoute({
  fetchImpl = fetch,
  loadHtml = loadStaticHtml,
  environment = process.env,
  timeoutMs = 3000,
} = {}) {
  return async function blogRoute(request) {
    let configuration
    try {
      configuration = runtimeEnvironment(environment)
    } catch {
      configuration = { name: 'production', noindex: false, siteOrigin: 'https://invalid.local', pocketBaseOrigin: 'https://invalid.local' }
      const page = await loadHtml('503.html')
      return htmlResponse(page, 503, configuration, { 'Retry-After': '60' })
    }

    const slug = new URL(request.url).searchParams.get('slug') || ''
    if (!SLUG_PATTERN.test(slug) || slug.length > 180) {
      return htmlResponse(await loadHtml('404.html'), 404, configuration)
    }

    let resolverResponse
    try {
      resolverResponse = await fetchImpl(
        `${configuration.pocketBaseOrigin}/api/monike/articles/${encodeURIComponent(slug)}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) },
      )
    } catch {
      return htmlResponse(await loadHtml('503.html'), 503, configuration, { 'Retry-After': '60' })
    }

    if (resolverResponse.status === 404) {
      return htmlResponse(await loadHtml('404.html'), 404, configuration)
    }
    if (!resolverResponse.ok) {
      return htmlResponse(await loadHtml('503.html'), 503, configuration, { 'Retry-After': '60' })
    }

    let result
    try {
      result = await resolverResponse.json()
    } catch {
      return htmlResponse(await loadHtml('503.html'), 503, configuration, { 'Retry-After': '60' })
    }

    if (result?.kind === 'alias' && /^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.location || '')) {
      return new Response(null, {
        status: 308,
        headers: responseHeaders(configuration, {
          Location: new URL(result.location, `${configuration.siteOrigin}/`).toString(),
        }),
      })
    }
    if (result?.kind !== 'canonical' || !validCanonicalRecord(result.record, slug)) {
      return htmlResponse(await loadHtml('503.html'), 503, configuration, { 'Retry-After': '60' })
    }

    try {
      return htmlResponse(
        articleHtml(await loadHtml('index.html'), result.record, configuration),
        200,
        configuration,
      )
    } catch {
      return htmlResponse(await loadHtml('503.html'), 503, configuration, { 'Retry-After': '60' })
    }
  }
}

const handler = createBlogRoute()
export function GET(request) {
  return handler(request)
}
