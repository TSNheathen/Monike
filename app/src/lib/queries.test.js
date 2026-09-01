import { parseCategoryQuery, publishedPostsFilter } from './queries.js'

describe('bezpečný filtr kategorií', () => {
  it('přijme právě jeden známý klíč', () => {
    expect(parseCategoryQuery(new URLSearchParams('category=cesty'))).toMatchObject({
      state: 'valid',
      key: 'cesty',
      category: { label: 'Cesty & příběhy' },
    })
    expect(parseCategoryQuery(new URLSearchParams()).state).toBe('all')
  })

  it('odmítne prázdnou, opakovanou a injekční hodnotu před sestavením filtru', () => {
    expect(parseCategoryQuery(new URLSearchParams('category=')).state).toBe('invalid')
    expect(parseCategoryQuery(new URLSearchParams('category=cesty&category=vzpominky')).state).toBe('invalid')
    expect(parseCategoryQuery(new URLSearchParams('category=cesty%22%20%7C%7C%20published%3Dtrue')).state).toBe('invalid')

    const client = { filter: vi.fn() }
    expect(() => publishedPostsFilter(client, 'cesty || published=true')).toThrow('Neplatná kategorie')
    expect(client.filter).not.toHaveBeenCalled()
  })

  it('předává důvěryhodný klíč přes parametr PocketBase filtru', () => {
    const client = {
      filter: vi.fn((expression, params) => `${expression}:${params.category}`),
    }
    const filter = publishedPostsFilter(client, 'vzpominky')
    expect(filter).toContain('{:category}:vzpominky')
    expect(client.filter).toHaveBeenCalledWith(
      expect.stringContaining('categories ~ {:category}'),
      { category: 'vzpominky' },
    )
  })
})
