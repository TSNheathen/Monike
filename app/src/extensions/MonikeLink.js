import Link from '@tiptap/extension-link'

export const MonikeLink = Link.extend({
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute('href'),
      },
    }
  },
})
