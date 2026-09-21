const ROLE_CONFIG = Object.freeze({
  'landing-background': Object.freeze({
    candidates: [[800, '800x0'], [1200, '1200x0'], [1600, '1600x0'], [2400, '2400x0']],
    sizes: '100vw',
    loading: 'eager',
    fetchPriority: 'high',
  }),
  landing: Object.freeze({
    candidates: [[480, '480x0'], [800, '800x0']],
    sizes: '(max-width: 1099px) 210px, 224px',
    loading: 'lazy',
  }),
  'gallery-grid': Object.freeze({
    candidates: [[480, '480x600'], [800, '800x1000']],
    sizes: '(max-width: 759px) calc(100vw - 64px), (max-width: 1099px) 45vw, 350px',
    loading: 'lazy',
    ratio: [4, 5],
  }),
  'gallery-lightbox': Object.freeze({
    candidates: [[1200, '1200x0'], [1600, '1600x0'], [2400, '2400x0']],
    sizes: '100vw',
  }),
  'blog-list': Object.freeze({
    candidates: [[480, '480x0'], [800, '800x0']],
    sizes: '(max-width: 759px) calc(100vw - 64px), 360px',
    loading: 'lazy',
  }),
  'article-cover': Object.freeze({
    candidates: [[480, '480x0'], [800, '800x0'], [1200, '1200x0'], [1600, '1600x0'], [2400, '2400x0']],
    sizes: '(max-width: 759px) calc(100vw - 64px), min(1120px, 100vw)',
    loading: 'eager',
    fetchPriority: 'high',
  }),
  'about-portrait': Object.freeze({
    candidates: [[480, '480x0'], [800, '800x0'], [1200, '1200x0'], [1600, '1600x0']],
    sizes: '(max-width: 759px) calc(100vw - 64px), 440px',
    loading: 'eager',
  }),
  'rich-text': Object.freeze({
    candidates: [[480, '480x0'], [800, '800x0'], [1200, '1200x0'], [1600, '1600x0']],
    sizes: '(max-width: 759px) calc(100vw - 64px), 760px',
    loading: 'lazy',
  }),
})

function getFileUrl(client, record, field, options = {}) {
  const filename = record?.[field]
  if (!record || !filename) return ''
  return client.files.getURL(record, filename, options)
}

export function richTextImageSizes(widthPercent) {
  const width = Number(widthPercent)
  if (!Number.isFinite(width) || width < 20 || width > 100) {
    throw new TypeError('Šířka obrázku musí být mezi 20 a 100 %.')
  }
  const mobileVw = Number((width).toFixed(2))
  const mobileGutter = Number((64 * width / 100).toFixed(2))
  const desktop = Number((760 * width / 100).toFixed(2))
  return `(max-width: 759px) calc(${mobileVw}vw - ${mobileGutter}px), ${desktop}px`
}

export function responsiveImage(client, {
  record,
  field,
  widthField,
  heightField,
  role,
  fileToken = '',
  widthPercent,
}) {
  const config = ROLE_CONFIG[role]
  if (!config) throw new TypeError(`Neznámá role obrázku: ${role}`)

  const naturalWidth = Number(record?.[widthField])
  const naturalHeight = Number(record?.[heightField])
  if (!record?.[field] || naturalWidth <= 0 || naturalHeight <= 0) {
    throw new TypeError('Obrázek nemá soubor nebo platné rozměry.')
  }

  const tokenOptions = fileToken ? { token: fileToken } : {}
  const original = getFileUrl(client, record, field, tokenOptions)
  const candidates = config.candidates
    .filter(([width]) => width <= naturalWidth)
    .map(([width, thumb]) => [
      width,
      getFileUrl(client, record, field, { ...tokenOptions, thumb }),
    ])

  const maxRoleWidth = config.candidates.at(-1)[0]
  if (naturalWidth < maxRoleWidth && !candidates.some(([width]) => width === naturalWidth)) {
    candidates.push([naturalWidth, original])
  }
  if (candidates.length === 0) candidates.push([naturalWidth, original])

  const [displayWidth, displayHeight] = config.ratio || [naturalWidth, naturalHeight]
  return Object.freeze({
    src: candidates[0][1],
    srcSet: candidates.map(([width, url]) => `${url} ${width}w`).join(', '),
    sizes: role === 'rich-text' && widthPercent
      ? richTextImageSizes(widthPercent)
      : config.sizes,
    width: displayWidth,
    height: displayHeight,
    loading: config.loading,
    fetchpriority: config.fetchPriority,
  })
}

export { ROLE_CONFIG as RESPONSIVE_IMAGE_ROLES }
