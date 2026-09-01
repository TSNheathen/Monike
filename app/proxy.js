import { next } from '@vercel/functions'

const DEPLOYED_ENVIRONMENTS = new Set(['demo', 'production'])

function hstsHeader(environment) {
  const configured = String(environment.MONIKE_HSTS_MAX_AGE || '300').trim()
  if (!/^\d+$/.test(configured)) throw new Error('Neplatný HSTS max-age.')
  const maxAge = Number(configured)
  if (!Number.isSafeInteger(maxAge) || maxAge < 0 || maxAge > 31_536_000) {
    throw new Error('HSTS max-age je mimo povolený rozsah.')
  }
  const includeSubDomains = environment.MONIKE_HSTS_INCLUDE_SUBDOMAINS === 'true'
  if (includeSubDomains && maxAge !== 31_536_000) {
    throw new Error('includeSubDomains je povolené až s ročním HSTS.')
  }
  return `max-age=${maxAge}${includeSubDomains ? '; includeSubDomains' : ''}`
}

export function securityHeaders(environment = process.env) {
  const name = environment.MONIKE_ENV || environment.VITE_APP_ENV || 'production'
  const pocketBaseValue = environment.MONIKE_POCKETBASE_URL || environment.VITE_POCKETBASE_URL
  if (!DEPLOYED_ENVIRONMENTS.has(name) || !pocketBaseValue) {
    throw new Error('Neplatná konfigurace bezpečnostních hlaviček.')
  }
  const pocketBase = new URL(pocketBaseValue)
  if (pocketBase.protocol !== 'https:' || pocketBase.username || pocketBase.password) {
    throw new Error('Nasazený PocketBase musí používat veřejný HTTPS origin.')
  }
  const apiOrigin = pocketBase.origin
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' ${apiOrigin} blob:`,
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}`,
    `media-src 'self' ${apiOrigin}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ')

  return {
    'Content-Security-Policy': contentSecurityPolicy,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()',
    'Strict-Transport-Security': hstsHeader(environment),
    ...(name === 'production' ? {} : { 'X-Robots-Tag': 'noindex,nofollow' }),
  }
}

export default function proxy() {
  try {
    return next({ headers: securityHeaders(process.env) })
  } catch {
    return new Response('Služba není správně nastavena.', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex,nofollow',
      },
    })
  }
}
