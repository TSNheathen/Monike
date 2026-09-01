import {
  API_ERROR_KINDS,
  MonikeApiError,
  collectionOutcome,
  normalizeApiError,
} from './api-errors.js'

describe('klasifikace API stavů', () => {
  it('nerozmělní prázdný seznam na chybu ani chybu na prázdný seznam', async () => {
    await expect(collectionOutcome(async () => [])).resolves.toEqual({
      state: 'empty',
      data: [],
      error: null,
    })

    const unavailable = await collectionOutcome(async () => {
      throw { status: 503 }
    })
    expect(unavailable.state).toBe('unavailable')
    expect(unavailable.data).toBeNull()
    expect(unavailable.error).toBeInstanceOf(MonikeApiError)
  })

  it('rozliší 404, konflikt, vypršenou relaci a chybná data', async () => {
    expect(normalizeApiError({ status: 404 }).kind).toBe(API_ERROR_KINDS.NOT_FOUND)
    expect(normalizeApiError({ status: 409 }).kind).toBe(API_ERROR_KINDS.CONFLICT)
    expect(normalizeApiError({ status: 401 }).kind).toBe(API_ERROR_KINDS.AUTH_EXPIRED)

    const invalidPayload = await collectionOutcome(async () => ({ records: [] }))
    expect(invalidPayload.state).toBe(API_ERROR_KINDS.CONFIGURATION)
  })
})
