import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  RichTextValidationError,
  serializeDocument,
  validateDocument,
  validateHref,
} = require('../../pb_hooks/lib/rich-text.js')

const assetId = 'abc123def456ghi'

function text(value, marks) {
  return { type: 'text', text: value, ...(marks ? { marks } : {}) }
}

describe('serverový rich-text kontrakt', () => {
  it('validuje a deterministicky serializuje všechny povolené uzly a značky', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [text('Nadpis & cesta')],
        },
        {
          type: 'paragraph',
          content: [
            text('Silně', [{ type: 'bold' }]),
            text(' a '),
            text('odkaz', [
              { type: 'italic' },
              { type: 'link', attrs: { href: '/blog?category=cesty' } },
            ]),
            { type: 'hardBreak' },
            text('<bezpečně>'),
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [text('První')] },
                {
                  type: 'orderedList',
                  content: [
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [text('Druhá úroveň')] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [text('Citace')] }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [text('Podnadpis')],
        },
        {
          type: 'monikeImage',
          attrs: {
            assetId,
            alt: 'Portrét "Moniké"',
            widthPercent: 50,
            align: 'center',
            wrap: 'none',
          },
        },
      ],
    }

    expect(validateDocument(document)).toEqual({
      assetIds: [assetId],
      hasMeaningfulContent: true,
    })
    const html = serializeDocument(document, {
      assetBaseUrl: 'https://api.example.test',
      resolveAsset: () => ({
        id: assetId,
        filename: 'obrazek_test.png',
        width: 1200,
        height: 800,
      }),
    })

    expect(html).toContain('<h2>Nadpis &amp; cesta</h2>')
    expect(html).toContain('<strong>Silně</strong>')
    expect(html).toContain('<a href="/blog?category=cesty"><em>odkaz</em></a>')
    expect(html).toContain('&lt;bezpečně&gt;')
    expect(html).toContain('<ul><li><p>První</p><ol>')
    expect(html).toContain('<blockquote><p>Citace</p></blockquote>')
    expect(html).toContain('rich-text-image--width-50')
    expect(html).toContain('alt="Portrét &quot;Moniké&quot;"')
    expect(html).not.toMatch(/<script|style=|onerror|target=/)
  })

  it('odmítá nepovolené uzly, značky, atributy a třetí úroveň seznamu', () => {
    const invalidDocuments = [
      { type: 'doc', content: [{ type: 'horizontalRule' }] },
      {
        type: 'doc',
        content: [{ type: 'paragraph', content: [text('x', [{ type: 'strike' }])] }],
      },
      {
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 1 }, content: [text('H1')] }],
      },
      {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [text('1')] },
                  {
                    type: 'bulletList',
                    content: [
                      {
                        type: 'listItem',
                        content: [
                          { type: 'paragraph', content: [text('2')] },
                          {
                            type: 'bulletList',
                            content: [
                              {
                                type: 'listItem',
                                content: [{ type: 'paragraph', content: [text('3')] }],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]

    for (const document of invalidDocuments) {
      expect(() => validateDocument(document)).toThrow(RichTextValidationError)
    }
  })

  it('povolí jen smluvené adresy odkazů', () => {
    for (const href of [
      'https://example.com/cesta',
      'http://example.com',
      'https://example.com:8443/cesta',
      'http://localhost:8090/test',
      'mailto:monike@example.com',
      '/gallery',
      '/blog?category=cesty',
    ]) {
      expect(validateHref(href)).toBe(true)
    }
    for (const href of [
      '//example.com',
      'javascript:alert(1)',
      'data:text/html,x',
      '../admin',
      'https://user@example.com',
      'https://example.com\\@evil.test',
      'https://example..com',
      'https://-example.com',
      'https://example.com:99999',
      'https://999.1.1.1',
      'mailto:neplatny@example',
    ]) {
      expect(validateHref(href)).toBe(false)
    }
  })

  it('vyžaduje přesný obrázkový kontrakt', () => {
    const base = {
      type: 'doc',
      content: [
        {
          type: 'monikeImage',
          attrs: { assetId, alt: 'Popis', widthPercent: 100, align: 'center', wrap: 'none' },
        },
      ],
    }
    expect(validateDocument(base).assetIds).toEqual([assetId])

    for (const attrs of [
      { ...base.content[0].attrs, alt: '' },
      { ...base.content[0].attrs, widthPercent: 19 },
      { ...base.content[0].attrs, widthPercent: 50.5 },
      { ...base.content[0].attrs, align: 'justify' },
      { ...base.content[0].attrs, wrap: 'both' },
      { ...base.content[0].attrs, src: 'https://evil.test/x.png' },
    ]) {
      expect(() =>
        validateDocument({
          type: 'doc',
          content: [{ type: 'monikeImage', attrs }],
        }),
      ).toThrow(RichTextValidationError)
    }
  })
})
