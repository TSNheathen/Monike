import { parseLabelQuery, publishedPostsFilter } from './queries.js'

describe('bezpečný filtr labelů', () => {
  it('přijme právě jeden syntakticky platný slug', () => {
    expect(parseLabelQuery(new URLSearchParams('label=cesty'))).toEqual({
      state: 'valid',
      slug: 'cesty',
    })
    expect(parseLabelQuery(new URLSearchParams()).state).toBe('all')
  })

  it('odmítne prázdnou, opakovanou a injekční hodnotu před sestavením filtru', () => {
    expect(parseLabelQuery(new URLSearchParams('label=')).state).toBe('invalid')
    expect(parseLabelQuery(new URLSearchParams('label=cesty&label=vzpominky')).state).toBe('invalid')
    expect(parseLabelQuery(new URLSearchParams('label=cesty%22%20%7C%7C%20published%3Dtrue')).state).toBe('invalid')

    const client = { filter: vi.fn() }
    expect(() => publishedPostsFilter(client, 'cesty || published=true')).toThrow('Neplatné ID labelu')
    expect(client.filter).not.toHaveBeenCalled()
  })

  it('předává důvěryhodné relation ID přes parametr PocketBase filtru', () => {
    const client = {
      filter: vi.fn((expression, params) => `${expression}:${params.label}`),
    }
    const filter = publishedPostsFilter(client, 'abc123def456ghi')
    expect(filter).toContain('{:label}:abc123def456ghi')
    expect(client.filter).toHaveBeenCalledWith(
      expect.stringContaining('labels.id ?= {:label}'),
      { label: 'abc123def456ghi' },
    )
  })
})
