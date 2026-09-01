import { responsiveImage, richTextImageSizes } from './media.js'

const client = {
  files: {
    getURL(record, filename, options = {}) {
      const thumb = options.thumb ? `?thumb=${options.thumb}` : ''
      const token = options.token ? `${thumb ? '&' : '?'}token=${options.token}` : ''
      return `https://pb.test/${record.id}/${filename}${thumb}${token}`
    },
  },
}

describe('responsive media helper', () => {
  const record = {
    id: 'image1',
    image: 'photo.jpg',
    image_width: 1500,
    image_height: 1000,
  }

  it('pro blogový seznam nevytvoří velké article kandidáty', () => {
    const image = responsiveImage(client, {
      record,
      field: 'image',
      widthField: 'image_width',
      heightField: 'image_height',
      role: 'blog-list',
    })
    expect(image.srcSet).toContain('480x0')
    expect(image.srcSet).toContain('800x0')
    expect(image.srcSet).not.toContain('1200x0')
    expect(image.loading).toBe('lazy')
  })

  it('neupscaluje malý master a přidá chráněný token do každého URL', () => {
    const small = responsiveImage(client, {
      record: { ...record, image_width: 700, image_height: 500 },
      field: 'image',
      widthField: 'image_width',
      heightField: 'image_height',
      role: 'about-portrait',
      fileToken: 'owner-token',
    })
    expect(small.srcSet).toContain('480x0')
    expect(small.srcSet).toContain('photo.jpg?token=owner-token 700w')
    expect(small.srcSet).not.toContain('800x0')
  })

  it('počítá velikost rich-text obrázku z šířky sazby', () => {
    expect(richTextImageSizes(50)).toBe('(max-width: 759px) calc(50vw - 32px), 380px')
    expect(() => richTextImageSizes(10)).toThrow('mezi 20 a 100')
  })
})
