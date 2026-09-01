import { getBlogCategory, isBlogCategoryKey } from '../config/categories.js'

export function parseCategoryQuery(searchParams) {
  const values = searchParams.getAll('category')

  if (values.length === 0) {
    return Object.freeze({ state: 'all', key: null, category: null })
  }

  if (values.length !== 1 || !isBlogCategoryKey(values[0])) {
    return Object.freeze({ state: 'invalid', key: null, category: null })
  }

  return Object.freeze({
    state: 'valid',
    key: values[0],
    category: getBlogCategory(values[0]),
  })
}

export function publishedPostsFilter(client, categoryKey = null) {
  if (categoryKey === null) return 'published = true && categories:length > 0'

  if (!isBlogCategoryKey(categoryKey)) {
    throw new TypeError(`Neplatná kategorie blogu: ${categoryKey}`)
  }

  return client.filter(
    'published = true && categories:length > 0 && categories ~ {:category}',
    { category: categoryKey },
  )
}
