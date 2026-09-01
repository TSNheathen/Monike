const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_INPUT_EDGE = 8192
const MAX_INPUT_PIXELS = 32_000_000
const MASTER_EDGE = 4096

export function normalizedDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('Obrázek nemá platné rozměry.')
  }
  if (width > MAX_INPUT_EDGE || height > MAX_INPUT_EDGE || width * height > MAX_INPUT_PIXELS) {
    throw new Error('Obrázek překračuje bezpečnostní limit 8192 px nebo 32 megapixelů.')
  }
  const scale = Math.min(1, MASTER_EDGE / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function canonicalMime(inputType, hasAlpha = false) {
  if (inputType === 'image/png') return 'image/png'
  if (inputType === 'image/webp') return hasAlpha ? 'image/png' : 'image/jpeg'
  if (inputType === 'image/jpeg') return 'image/jpeg'
  throw new Error('Povolené jsou pouze obrázky JPEG, PNG a WebP.')
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' })
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Obrázek se nepodařilo převést.')),
      type,
      quality,
    )
  })
}

function containsAlpha(context, width, height) {
  const pixels = context.getImageData(0, 0, width, height).data
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 255) return true
  }
  return false
}

function normalizedFilename(name, mime) {
  const stem = String(name || 'obrazek').replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '-') || 'obrazek'
  return `${stem}.${mime === 'image/png' ? 'png' : 'jpg'}`
}

export async function normalizeAdminImage(file, { maxBytes = 10 * 1024 * 1024 } = {}) {
  if (!(file instanceof Blob) || !ALLOWED_TYPES.has(file.type)) {
    throw new Error('Povolené jsou pouze obrázky JPEG, PNG a WebP.')
  }

  let decoded
  try {
    decoded = await decodeImage(file)
  } catch {
    throw new Error('Obrázek je poškozený nebo ho prohlížeč nedokáže načíst.')
  }

  try {
    const sourceWidth = decoded.width || decoded.naturalWidth
    const sourceHeight = decoded.height || decoded.naturalHeight
    const dimensions = normalizedDimensions(sourceWidth, sourceHeight)
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('Prohlížeč nepodporuje bezpečné zpracování obrázku.')
    context.drawImage(decoded, 0, 0, dimensions.width, dimensions.height)

    const hasAlpha = file.type === 'image/webp'
      ? containsAlpha(context, dimensions.width, dimensions.height)
      : false
    const mime = canonicalMime(file.type, hasAlpha)
    const blob = await canvasBlob(canvas, mime, mime === 'image/jpeg' ? 0.9 : undefined)
    if (blob.size > maxBytes) {
      throw new Error(`Normalizovaný obrázek je větší než ${Math.round(maxBytes / 1024 / 1024)} MiB.`)
    }
    return new File([blob], normalizedFilename(file.name, mime), {
      type: mime,
      lastModified: Date.now(),
    })
  } finally {
    decoded.close?.()
  }
}
