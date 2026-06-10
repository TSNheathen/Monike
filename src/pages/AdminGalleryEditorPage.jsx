import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminFrame } from '../components/SiteFrame.jsx'
import { api } from '../lib/pocketbase.js'

export default function AdminGalleryEditorPage() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    try {
      await api.createGalleryImage(formData)
      navigate('/admin/gallery')
    } catch {
      setMessage('Obrázek se nepodařilo uložit. Je PocketBase spuštěný?')
    }
  }

  return (
    <AdminFrame title="Editor galerie">
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Název
          <input name="title" />
        </label>
        <label>
          Obrázek
          <input name="image" type="file" accept="image/*" />
        </label>
        <label>
          Alternativní text
          <input name="alt_text" />
        </label>
        <label>
          Popisek
          <textarea name="caption" />
        </label>
        <label>
          Pořadí
          <input name="sort_order" type="number" defaultValue="1" />
        </label>
        <label className="checkbox-row">
          <input name="published" type="checkbox" value="true" />
          Publikovat
        </label>
        {message && <p role="alert">{message}</p>}
        <button type="submit">Uložit obrázek</button>
      </form>
    </AdminFrame>
  )
}
