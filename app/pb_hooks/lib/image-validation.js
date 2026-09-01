'use strict'

const FORMATS = Object.freeze({
  jpeg: { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  png: { mime: 'image/png', extensions: ['png'] },
  webp: { mime: 'image/webp', extensions: ['webp'] },
})

const MAX_DIMENSION = 8192
const MAX_PIXELS = 32 * 1024 * 1024

class ImageValidationError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'ImageValidationError'
    this.code = code || 'invalid_image'
  }
}

function fail(message, code) {
  throw new ImageValidationError(message, code)
}

function byte(bytes, index) {
  return Number(bytes[index]) & 0xff
}

function u16be(bytes, offset) {
  return byte(bytes, offset) * 256 + byte(bytes, offset + 1)
}

function u16le(bytes, offset) {
  return byte(bytes, offset) + byte(bytes, offset + 1) * 256
}

function u24le(bytes, offset) {
  return byte(bytes, offset) + byte(bytes, offset + 1) * 256 + byte(bytes, offset + 2) * 65536
}

function u32be(bytes, offset) {
  return (
    byte(bytes, offset) * 16777216 +
    byte(bytes, offset + 1) * 65536 +
    byte(bytes, offset + 2) * 256 +
    byte(bytes, offset + 3)
  )
}

function ascii(bytes, offset, length) {
  let value = ''
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(byte(bytes, offset + index))
  }
  return value
}

function parsePng(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 33 || !signature.every((value, index) => byte(bytes, index) === value)) {
    return null
  }
  if (ascii(bytes, 12, 4) !== 'IHDR' || u32be(bytes, 8) !== 13) {
    fail('PNG nemá platnou hlavičku.', 'corrupt_image')
  }
  return { format: 'png', width: u32be(bytes, 16), height: u32be(bytes, 20) }
}

function parseJpeg(bytes) {
  if (bytes.length < 4 || byte(bytes, 0) !== 0xff || byte(bytes, 1) !== 0xd8) return null
  const startOfFrame = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ])
  let offset = 2
  while (offset + 3 < bytes.length) {
    if (byte(bytes, offset) !== 0xff) fail('JPEG je poškozený.', 'corrupt_image')
    while (offset < bytes.length && byte(bytes, offset) === 0xff) offset += 1
    const marker = byte(bytes, offset)
    offset += 1
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 1 >= bytes.length) fail('JPEG je neúplný.', 'corrupt_image')
    const length = u16be(bytes, offset)
    if (length < 2 || offset + length > bytes.length) fail('JPEG je neúplný.', 'corrupt_image')
    if (startOfFrame.has(marker)) {
      if (length < 7) fail('JPEG nemá platné rozměry.', 'corrupt_image')
      return {
        format: 'jpeg',
        width: u16be(bytes, offset + 5),
        height: u16be(bytes, offset + 3),
      }
    }
    offset += length
  }
  fail('JPEG nemá čitelnou obrazovou hlavičku.', 'corrupt_image')
}

function parseWebp(bytes) {
  if (
    bytes.length < 30 ||
    ascii(bytes, 0, 4) !== 'RIFF' ||
    ascii(bytes, 8, 4) !== 'WEBP'
  ) {
    return null
  }
  const chunk = ascii(bytes, 12, 4)
  const dataOffset = 20
  if (chunk === 'VP8X') {
    return {
      format: 'webp',
      width: u24le(bytes, dataOffset + 4) + 1,
      height: u24le(bytes, dataOffset + 7) + 1,
    }
  }
  if (chunk === 'VP8 ') {
    if (
      byte(bytes, dataOffset + 3) !== 0x9d ||
      byte(bytes, dataOffset + 4) !== 0x01 ||
      byte(bytes, dataOffset + 5) !== 0x2a
    ) {
      fail('WebP nemá platnou obrazovou hlavičku.', 'corrupt_image')
    }
    return {
      format: 'webp',
      width: u16le(bytes, dataOffset + 6) & 0x3fff,
      height: u16le(bytes, dataOffset + 8) & 0x3fff,
    }
  }
  if (chunk === 'VP8L') {
    if (byte(bytes, dataOffset) !== 0x2f) {
      fail('WebP nemá platnou obrazovou hlavičku.', 'corrupt_image')
    }
    const b1 = byte(bytes, dataOffset + 1)
    const b2 = byte(bytes, dataOffset + 2)
    const b3 = byte(bytes, dataOffset + 3)
    const b4 = byte(bytes, dataOffset + 4)
    return {
      format: 'webp',
      width: 1 + ((b1 | (b2 << 8)) & 0x3fff),
      height: 1 + (((b2 >> 6) | (b3 << 2) | (b4 << 10)) & 0x3fff),
    }
  }
  fail('WebP používá nepodporovaný obrazový formát.', 'corrupt_image')
}

function extensionOf(filename) {
  const match = String(filename || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/)
  return match ? match[1] : ''
}

function validateImage(bytes, options) {
  const settings = options || {}
  const size = Number(bytes && bytes.length)
  const maxBytes = Number(settings.maxBytes) || 10 * 1024 * 1024
  const maxDimension = Number(settings.maxDimension) || MAX_DIMENSION
  const maxPixels = Number(settings.maxPixels) || MAX_PIXELS
  if (!size) fail('Soubor obrázku je prázdný.', 'empty_image')
  if (size > maxBytes) fail('Obrázek překračuje povolenou velikost.', 'image_too_large')

  const parsed = parsePng(bytes) || parseJpeg(bytes) || parseWebp(bytes)
  if (!parsed) fail('Povolené jsou pouze obrázky JPEG, PNG a WebP.', 'unsupported_image')

  const format = FORMATS[parsed.format]
  const extension = extensionOf(settings.filename)
  if (!format.extensions.includes(extension)) {
    fail('Přípona souboru neodpovídá obrázku.', 'image_extension_mismatch')
  }
  const suppliedMime = String(settings.mime || '').toLowerCase().split(';')[0].trim()
  if (suppliedMime && suppliedMime !== format.mime) {
    fail('Typ souboru neodpovídá jeho obsahu.', 'image_mime_mismatch')
  }
  if (
    !Number.isInteger(parsed.width) ||
    !Number.isInteger(parsed.height) ||
    parsed.width < 1 ||
    parsed.height < 1
  ) {
    fail('Obrázek nemá platné rozměry.', 'invalid_dimensions')
  }
  if (
    parsed.width > maxDimension ||
    parsed.height > maxDimension ||
    parsed.width * parsed.height > maxPixels
  ) {
    fail('Rozměry obrázku překračují bezpečný limit.', 'unsafe_dimensions')
  }
  return { ...parsed, mime: format.mime, extension }
}

module.exports = {
  ImageValidationError,
  MAX_DIMENSION,
  MAX_PIXELS,
  validateImage,
}
