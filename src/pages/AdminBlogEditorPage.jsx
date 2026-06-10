import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminFrame } from '../components/SiteFrame.jsx'
import RichTextEditor from '../components/RichTextEditor.jsx'
import { api } from '../lib/pocketbase.js'

export default function AdminBlogEditorPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content_html: '<p></p>',
    content_json: {},
    published: false,
  })
  const [message, setMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      await api.createPost({
        ...form,
        published_at: form.published ? new Date().toISOString() : '',
      })
      navigate('/admin/blog')
    } catch {
      setMessage('Článek se nepodařilo uložit. Je PocketBase spuštěný?')
    }
  }

  return (
    <AdminFrame title="Editor článku">
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Název
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label>
          Slug
          <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
        </label>
        <label>
          Perex
          <textarea value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} />
        </label>
        <RichTextEditor
          value={form.content_html}
          onChange={({ html, json }) => setForm({ ...form, content_html: html, content_json: json })}
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(event) => setForm({ ...form, published: event.target.checked })}
          />
          Publikovat
        </label>
        {message && <p role="alert">{message}</p>}
        <button type="submit">Uložit článek</button>
      </form>
    </AdminFrame>
  )
}
