export const API_ERROR_KINDS = Object.freeze({
  AUTH_EXPIRED: 'auth-expired',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not-found',
  UNAVAILABLE: 'unavailable',
  VALIDATION: 'validation',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate-limited',
  CONFIGURATION: 'configuration',
  ERROR: 'error',
})

export class MonikeApiError extends Error {
  constructor(kind, message, options = {}) {
    super(message, { cause: options.cause })
    this.name = 'MonikeApiError'
    this.kind = kind
    this.status = options.status || 0
    this.details = options.details || null
  }
}

export function isAuthenticationError(error) {
  return (
    error?.kind === API_ERROR_KINDS.AUTH_EXPIRED ||
    error?.kind === API_ERROR_KINDS.FORBIDDEN ||
    error?.status === 401 ||
    error?.status === 403
  )
}

export function normalizeApiError(error, message = 'Požadavek se nezdařil.') {
  if (error instanceof MonikeApiError) return error

  const status = Number(error?.status || error?.response?.status || 0)
  let kind = API_ERROR_KINDS.ERROR

  if (status === 401) kind = API_ERROR_KINDS.AUTH_EXPIRED
  else if (status === 403) kind = API_ERROR_KINDS.FORBIDDEN
  else if (status === 404) kind = API_ERROR_KINDS.NOT_FOUND
  else if (status === 409) kind = API_ERROR_KINDS.CONFLICT
  else if (status === 429) kind = API_ERROR_KINDS.RATE_LIMITED
  else if (status === 400 || status === 422) kind = API_ERROR_KINDS.VALIDATION
  else if (status === 0 || status >= 500) kind = API_ERROR_KINDS.UNAVAILABLE

  return new MonikeApiError(kind, message, {
    cause: error,
    status,
    details: error?.response?.data || error?.data || null,
  })
}

export function configurationError(message, details) {
  return new MonikeApiError(API_ERROR_KINDS.CONFIGURATION, message, { details })
}

export async function collectionOutcome(loader) {
  try {
    const records = await loader()
    if (!Array.isArray(records)) {
      throw configurationError('Server vrátil neplatný seznam záznamů.')
    }
    return records.length
      ? { state: 'ready', data: records, error: null }
      : { state: 'empty', data: [], error: null }
  } catch (error) {
    const normalized = normalizeApiError(error)
    return { state: normalized.kind, data: null, error: normalized }
  }
}
