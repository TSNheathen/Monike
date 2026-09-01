import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminFrame } from '../components/SiteFrame.jsx'
import { api } from '../lib/pocketbase.js'
import { sampleGallery } from '../data/landing.js'

export default function AdminGalleryPage() {
  const [items, setItems] = useState(sampleGallery)

  useEffect(() => {
    api.gallery(false).then((records) => {
      if (records.length) setItems(records)
    }).catch(() => setItems(sampleGallery))
  }, [])

  return (
    <AdminFrame
      title="Správa galerie"
      actions={<Link className="admin-action" to="/admin/gallery/new">Nový obrázek</Link>}
    >
      <div className="admin-table">
        {items.map((item) => (
          <article key={item.id}>
            <div>
              <h2>{item.title}</h2>
              <p>{item.caption}</p>
            </div>
            <Link to={`/admin/gallery/${item.id}/edit`}>Upravit</Link>
          </article>
        ))}
      </div>
    </AdminFrame>
  )
}
