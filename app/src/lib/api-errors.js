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

const DEFAULT_FAILURE_MESSAGE = 'Operaci se nepodařilo dokončit.'
const FIELD_LABELS = Object.freeze({
  alt_text: 'Alternativní text',
  caption: 'Popisek',
  color: 'Barva',
  content_html: 'Vygenerovaný obsah',
  content_json: 'Obsah',
  email: 'E-mail',
  excerpt: 'Perex',
  image: 'Obrázek',
  label: 'Cílový label',
  labels: 'Labely',
  name: 'Název',
  password: 'Heslo',
  portrait: 'Portrét',
  portrait_alt: 'Alternativní text portrétu',
  slug: 'Slug',
  sort_order: 'Pořadí',
  title: 'Název',
})

function collectValidationDetails(value, path = [], entries = []) {
  if (!value || typeof value !== 'object' || entries.length >= 8) return entries
  if (typeof value.message === 'string' && value.message.trim()) {
    entries.push({
      field: path[0] || '',
      code: typeof value.code === 'string' ? value.code : '',
      message: value.message.trim(),
    })
    return entries
  }
  for (const [key, child] of Object.entries(value)) {
    if (['code', 'status'].includes(key)) continue
    collectValidationDetails(child, [...path, key], entries)
  }
  return entries
}

function localizedValidationMessage({ field, code, message }) {
  const label = FIELD_LABELS[field] || field
  if (/required/i.test(code)) return `${label || 'Hodnota'} je povinná.`
  if (/unique/i.test(code)) {
    return `${label || 'Hodnota'} musí být unikátní; stejnou hodnotu už používá jiný záznam.`
  }
  if (/invalid_email/i.test(code)) return `${label || 'E-mail'} nemá platný formát.`
  return label ? `${label}: ${message}` : message
}

function validationMessage(details) {
  const messages = collectValidationDetails(details).map(localizedValidationMessage)
  return [...new Set(messages)].join(' ')
}

function serverMessage(error) {
  const candidate = error?.response?.message || error?.data?.message || ''
  if (typeof candidate !== 'string' || !candidate.trim()) return ''
  if (/^(something went wrong|failed to|request failed|the request|fetch failed|load failed|networkerror)/i.test(candidate.trim())) {
    return ''
  }
  return candidate.trim()
}

function fallbackMessage(kind, context, status) {
  if (kind === API_ERROR_KINDS.AUTH_EXPIRED) {
    return 'Přihlášení vypršelo. Přihlas se znovu a potom akci zopakuj.'
  }
  if (kind === API_ERROR_KINDS.FORBIDDEN) {
    return 'Přihlášený účet nemá oprávnění k této akci.'
  }
  if (kind === API_ERROR_KINDS.NOT_FOUND) return context || 'Požadovaný obsah už neexistuje.'
  if (kind === API_ERROR_KINDS.CONFLICT) {
    return `${context || DEFAULT_FAILURE_MESSAGE} Obsah byl mezitím změněn; načti aktuální verzi.`
  }
  if (kind === API_ERROR_KINDS.RATE_LIMITED) {
    return 'Proběhlo příliš mnoho požadavků. Počkej minutu a potom akci zopakuj.'
  }
  if (kind === API_ERROR_KINDS.VALIDATION) {
    return `${context || DEFAULT_FAILURE_MESSAGE} Zkontroluj vyplněné hodnoty.`
  }
  if (kind === API_ERROR_KINDS.UNAVAILABLE) {
    return status === 0
      ? `${context || DEFAULT_FAILURE_MESSAGE} PocketBase neodpověděl; zkontroluj, že běží, a zkus akci znovu.`
      : `${context || DEFAULT_FAILURE_MESSAGE} Server vrátil chybu ${status}; zkus akci znovu.`
  }
  return status
    ? `${context || DEFAULT_FAILURE_MESSAGE} Server vrátil HTTP ${status}.`
    : context || DEFAULT_FAILURE_MESSAGE
}

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

export function normalizeApiError(error, message = DEFAULT_FAILURE_MESSAGE) {
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

  const details = error?.response?.data || error?.data || null
  const preciseMessage = validationMessage(details) || serverMessage(error)

  return new MonikeApiError(kind, preciseMessage || fallbackMessage(kind, message, status), {
    cause: error,
    status,
    details,
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
