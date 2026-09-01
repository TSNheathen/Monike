import { Node, mergeAttributes } from '@tiptap/core'

export function createMonikeImageExtension(resolveAssetUrl = () => '') {
  return Node.create({
    name: 'monikeImage',
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes() {
      return {
        assetId: { default: null },
        alt: { default: '' },
        widthPercent: { default: 100 },
        align: { default: 'center' },
        wrap: { default: 'none' },
      }
    },

    parseHTML() {
      return [{
        tag: 'figure[data-monike-image]',
        getAttrs: (element) => ({
          assetId: element.dataset.assetId,
          alt: element.querySelector('img')?.getAttribute('alt') || '',
          widthPercent: Number(element.dataset.widthPercent || 100),
          align: element.dataset.align || 'center',
          wrap: element.dataset.wrap || 'none',
        }),
      }]
    },

    renderHTML({ node, HTMLAttributes }) {
      const { assetId, alt, widthPercent, align, wrap } = node.attrs
      const src = resolveAssetUrl(assetId)
      return [
        'figure',
        mergeAttributes(HTMLAttributes, {
          class: [
            'rich-text-image',
            `rich-text-image--width-${widthPercent}`,
            `rich-text-image--align-${align}`,
            `rich-text-image--wrap-${wrap}`,
          ].join(' '),
          'data-monike-image': '',
          'data-asset-id': assetId,
          'data-width-percent': widthPercent,
          'data-align': align,
          'data-wrap': wrap,
        }),
        ['img', { src, alt, draggable: 'false' }],
      ]
    },
  })
}
