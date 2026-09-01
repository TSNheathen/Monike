export const BLOG_CATEGORIES = Object.freeze([
  Object.freeze({ key: 'cesty', label: 'Cesty & příběhy' }),
  Object.freeze({ key: 'vzpominky', label: 'Vzpomínky' }),
  Object.freeze({ key: 'kocicky-andy', label: 'Kočičky & Andy' }),
  Object.freeze({ key: 'proces-tvorby', label: 'Proces tvorby' }),
])

export const BLOG_CATEGORY_KEYS = Object.freeze(
  BLOG_CATEGORIES.map(({ key }) => key),
)

export function getBlogCategory(key) {
  return BLOG_CATEGORIES.find((category) => category.key === key) || null
}

export function isBlogCategoryKey(key) {
  return BLOG_CATEGORY_KEYS.includes(key)
}
