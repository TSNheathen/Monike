import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { ImageValidationError, validateImage } = require(
  '../../pb_hooks/lib/image-validation.js',
)

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

describe('serverová kontrola obrázků', () => {
  it('odvodí formát a rozměry z binární signatury', () => {
    expect(
      validateImage(png, { filename: 'obrazek.png', mime: 'image/png' }),
    ).toEqual({
      format: 'png',
      mime: 'image/png',
      extension: 'png',
      width: 1,
      height: 1,
    })
  })

  it('odmítne přejmenovaný, MIME-neshodný, prázdný a příliš velký soubor', () => {
    for (const [bytes, options] of [
      [png, { filename: 'obrazek.jpg', mime: 'image/jpeg' }],
      [png, { filename: 'obrazek.png', mime: 'image/jpeg' }],
      [Buffer.alloc(0), { filename: 'obrazek.png', mime: 'image/png' }],
      [png, { filename: 'obrazek.png', mime: 'image/png', maxBytes: 16 }],
      [Buffer.from('<svg><script/></svg>'), { filename: 'obrazek.png', mime: 'image/png' }],
    ]) {
      expect(() => validateImage(bytes, options)).toThrow(ImageValidationError)
    }
  })

  it('odmítne rozměry přes 8192 px nebo 32 megapixelů', () => {
    const unsafePng = Buffer.from(png)
    unsafePng.writeUInt32BE(8193, 16)
    unsafePng.writeUInt32BE(4096, 20)
    expect(() =>
      validateImage(unsafePng, { filename: 'obrazek.png', mime: 'image/png' }),
    ).toThrow(/bezpečný limit/)
  })

  it('na serverové hranici umí vynutit 4096px normalizovaný master', () => {
    const oversizedMaster = Buffer.from(png)
    oversizedMaster.writeUInt32BE(4097, 16)
    oversizedMaster.writeUInt32BE(1, 20)
    expect(() => validateImage(oversizedMaster, {
      filename: 'obrazek.png',
      mime: 'image/png',
      maxDimension: 4096,
    })).toThrow(/bezpečný limit/)
  })
})
