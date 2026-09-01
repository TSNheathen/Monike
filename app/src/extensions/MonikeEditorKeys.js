import { Extension } from '@tiptap/core'
import { listDepthAtSelection } from '../lib/rich-text-client.js'

export function createMonikeEditorKeys(onOpenLink) {
  return Extension.create({
    name: 'monikeEditorKeys',

    addKeyboardShortcuts() {
      return {
        'Mod-k': () => {
          onOpenLink()
          return true
        },
        Tab: () => {
          if (!this.editor.isActive('listItem')) return false
          if (listDepthAtSelection(this.editor.state) >= 2) return true
          return this.editor.commands.sinkListItem('listItem')
        },
        'Shift-Tab': () => {
          if (!this.editor.isActive('listItem')) return false
          return this.editor.commands.liftListItem('listItem')
        },
      }
    },
  })
}
