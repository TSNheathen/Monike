import { BaseAuthStore } from 'pocketbase'
import { isAuthenticationError, normalizeApiError } from './api-errors.js'

export const OWNER_SESSION_KEY = 'monike_owner_session_v1'
export const OWNER_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000

function browserSessionStorage() {
  try {
    return globalThis.sessionStorage || null
  } catch {
    return null
  }
}

function readSession(storage, now) {
  if (!storage) return null

  try {
    const parsed = JSON.parse(storage.getItem(OWNER_SESSION_KEY) || 'null')
    if (
      !parsed ||
      typeof parsed.token !== 'string' ||
      !parsed.record ||
      typeof parsed.savedAt !== 'number' ||
      now() - parsed.savedAt >= OWNER_SESSION_MAX_AGE_MS
    ) {
      storage.removeItem(OWNER_SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    storage.removeItem(OWNER_SESSION_KEY)
    return null
  }
}

export class SessionAuthStore extends BaseAuthStore {
  constructor({ storage = browserSessionStorage(), now = Date.now } = {}) {
    super()
    this.storage = storage
    this.now = now

    const session = readSession(storage, now)
    if (session) super.save(session.token, session.record)
  }

  save(token, record) {
    super.save(token, record)
    if (!this.storage) return

    if (!token || !record) {
      this.storage.removeItem(OWNER_SESSION_KEY)
      return
    }

    this.storage.setItem(
      OWNER_SESSION_KEY,
      JSON.stringify({ token, record, savedAt: this.now() }),
    )
  }

  clear() {
    super.clear()
    this.storage?.removeItem(OWNER_SESSION_KEY)
  }
}

export async function executeAuthenticated(action, requestReauthentication) {
  try {
    return { status: 'complete', value: await action() }
  } catch (error) {
    const normalized = normalizeApiError(error)
    if (!isAuthenticationError(normalized)) throw normalized

    await requestReauthentication()
    return { status: 'reauthenticated', retryRequired: true }
  }
}
