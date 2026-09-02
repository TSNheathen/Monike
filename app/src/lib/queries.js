const LABEL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RECORD_ID_PATTERN = /^[a-z0-9]{15}$/

export function parseLabelQuery(searchParams) {
  const values = searchParams.getAll('label')
  if (values.length === 0) return Object.freeze({ state: 'all', slug: null })
  if (
    values.length !== 1 ||
    values[0].length > 80 ||
    !LABEL_SLUG_PATTERN.test(values[0])
  ) {
    return Object.freeze({ state: 'invalid', slug: null })
  }
  return Object.freeze({ state: 'valid', slug: values[0] })
}

export function publishedPostsFilter(client, labelId = null) {
  if (labelId === null) return 'published = true && labels:length > 0'
  if (!RECORD_ID_PATTERN.test(labelId)) {
    throw new TypeError(`Neplatné ID labelu blogu: ${labelId}`)
  }
  return client.filter(
    'published = true && labels:length > 0 && labels.id ?= {:label}',
    { label: labelId },
  )
}
