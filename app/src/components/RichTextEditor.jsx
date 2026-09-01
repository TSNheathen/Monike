import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export default function RichTextEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '<p></p>',
    onUpdate({ editor: currentEditor }) {
      onChange({
        html: currentEditor.getHTML(),
        json: currentEditor.getJSON(),
      })
    },
  })

  return (
    <div className="editor-shell">
      <div className="editor-toolbar" aria-label="Nástroje editoru">
        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>
          B
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}>
          I
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </button>
      </div>
      <EditorContent editor={editor} className="editor-content" />
    </div>
  )
}
