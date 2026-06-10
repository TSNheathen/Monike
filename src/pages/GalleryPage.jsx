import { useEffect, useState } from 'react'
import GLightbox from 'glightbox'
import 'glightbox/dist/css/glightbox.css'
import { PublicFrame } from '../components/SiteFrame.jsx'
import { api } from '../lib/pocketbase.js'
import { sampleGallery } from '../data/landing.js'

export default function GalleryPage() {
  const [items, setItems] = useState(sampleGallery)

  useEffect(() => {
    api.gallery(true).then((records) => {
      if (records.length) setItems(records)
    }).catch(() => setItems(sampleGallery))
  }, [])

  useEffect(() => {
    const lightbox = GLightbox({ selector: '.gallery-lightbox' })
    return () => lightbox.destroy()
  }, [items])

  return (
    <PublicFrame title="Galerie">
      <div className="gallery-grid">
        {items.map((item) => {
          const src = item.imageUrl || item.image
          return (
            <a
              key={item.id}
              className="gallery-item gallery-lightbox"
              href={src}
              data-gallery="monike"
              data-title={item.title}
            >
              <img src={src} alt={item.alt_text || item.title} />
              <span>{item.title}</span>
            </a>
          )
        })}
      </div>
    </PublicFrame>
  )
}
