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

  it('zobrazí přesný serverový validační důvod místo obecné chyby', () => {
    const normalized = normalizeApiError({
      status: 400,
      response: {
        message: 'Zadaná data nejsou platná.',
        data: {
          content_json: {
            code: 'invalid_link',
            message: 'Odkaz používá nepovolenou adresu.',
          },
        },
      },
    }, 'Stránku O mně se nepodařilo uložit.')

    expect(normalized.kind).toBe(API_ERROR_KINDS.VALIDATION)
    expect(normalized.message).toBe('Obsah: Odkaz používá nepovolenou adresu.')
  })

  it('vysvětlí nedostupný PocketBase a zachová konkrétní konflikt', () => {
    expect(normalizeApiError(
      { status: 0 },
      'Galerii se nepodařilo načíst.',
    ).message).toBe(
      'Galerii se nepodařilo načíst. PocketBase neodpověděl; zkontroluj, že běží, a zkus akci znovu.',
    )
    expect(normalizeApiError({
      status: 409,
      response: { message: 'Stránka byla mezitím změněna v jiné kartě.' },
    }).message).toBe('Stránka byla mezitím změněna v jiné kartě.')
  })
})
