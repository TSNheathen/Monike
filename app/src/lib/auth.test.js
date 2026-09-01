import {
  OWNER_SESSION_KEY,
  OWNER_SESSION_MAX_AGE_MS,
  SessionAuthStore,
  executeAuthenticated,
} from './auth.js'

function tokenWithLongExpiry() {
  const payload = btoa(JSON.stringify({ exp: 4102444800 })).replaceAll('=', '')
  return `header.${payload}.signature`
}

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('session-only přihlášení vlastníka', () => {
  it('obnoví relaci pouze v rámci sessionStorage a nejvýše osm hodin', () => {
    const storage = memoryStorage()
    let now = 1_000
    const first = new SessionAuthStore({ storage, now: () => now })
    first.save(tokenWithLongExpiry(), { id: 'owner', collectionName: 'admins' })

    expect(new SessionAuthStore({ storage, now: () => now }).isValid).toBe(true)
    now += OWNER_SESSION_MAX_AGE_MS
    expect(new SessionAuthStore({ storage, now: () => now }).isValid).toBe(false)
    expect(storage.getItem(OWNER_SESSION_KEY)).toBeNull()
  })

  it('odhlášení odstraní uloženou relaci', () => {
    const storage = memoryStorage()
    const store = new SessionAuthStore({ storage })
    store.save(tokenWithLongExpiry(), { id: 'owner', collectionName: 'admins' })
    store.clear()
    expect(store.isValid).toBe(false)
    expect(storage.getItem(OWNER_SESSION_KEY)).toBeNull()
  })

  it('po reautentizaci automaticky neopakuje původní operaci', async () => {
    const action = vi.fn().mockRejectedValue({ status: 401 })
    const reauthenticate = vi.fn().mockResolvedValue(undefined)
    await expect(executeAuthenticated(action, reauthenticate)).resolves.toEqual({
      status: 'reauthenticated',
      retryRequired: true,
    })
    expect(action).toHaveBeenCalledTimes(1)
    expect(reauthenticate).toHaveBeenCalledTimes(1)
  })

  it('považuje i zamítnutou chráněnou operaci za požadavek na reautentizaci', async () => {
    const reauthenticate = vi.fn().mockResolvedValue(undefined)
    const result = await executeAuthenticated(
      vi.fn().mockRejectedValue({ status: 403 }),
      reauthenticate,
    )
    expect(result.status).toBe('reauthenticated')
    expect(reauthenticate).toHaveBeenCalledOnce()
  })
})
