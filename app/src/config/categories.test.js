import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_KEYS,
  getBlogCategory,
  isBlogCategoryKey,
} from './categories.js'

describe('pevný registr kategorií', () => {
  it('obsahuje právě čtyři smluvené strojové klíče', () => {
    expect(BLOG_CATEGORY_KEYS).toEqual([
      'cesty',
      'vzpominky',
      'kocicky-andy',
      'proces-tvorby',
    ])
    expect(BLOG_CATEGORIES).toHaveLength(4)
  })

  it('vrací české popisky a odmítá neznámé klíče', () => {
    expect(getBlogCategory('kocicky-andy')).toEqual({
      key: 'kocicky-andy',
      label: 'Kočičky & Andy',
    })
    expect(getBlogCategory('nezname')).toBeNull()
    expect(isBlogCategoryKey('cesty')).toBe(true)
    expect(isBlogCategoryKey('cesty || published = true')).toBe(false)
  })
})
