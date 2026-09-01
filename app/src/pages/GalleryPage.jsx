import { useEffect, useMemo } from 'react'
import GLightbox from 'glightbox'
import 'glightbox/dist/css/glightbox.css'
import { PublicFrame } from '../components/SiteFrame.jsx'
import { ImageWithFallback, PublicRequestState } from '../components/PublicContent.jsx'
import { loadGallery } from '../data/public-content.js'
import { usePublicResource } from '../hooks/usePublicResource.js'
import { usePageMetadata } from '../hooks/usePageMetadata.js'
import { pageMetadata } from '../lib/metadata.js'
import { pb } from '../lib/pocketbase.js'
import { responsiveImage } from '../lib/media.js'

function imageProps(item, role) {
  if (item.image.startsWith('/')) {
    return { src: item.image, width: item.image_width || 1024, height: item.image_height || 1280, loading: role === 'gallery-grid' ? 'lazy' : undefined }
  }
  return responsiveImage(pb, {
    record: item,
    field: 'image',
    widthField: 'image_width',
    heightField: 'image_height',
    role,
  })
}

export default function GalleryPage() {
  const request = usePublicResource(loadGallery)
  const items = Array.isArray(request.data) ? request.data : []
  const state = request.state === 'ready' && items.length === 0 ? 'empty' : request.state
  const hasError = ['unavailable', 'error', 'configuration'].includes(request.state)
  const metadata = useMemo(() => pageMetadata({
    title: 'Galerie | Moniké',
    description: 'Galerie obrazů, kreseb, portrétů, ilustrací a fotografií Moniké.',
    path: '/gallery',
    robots: hasError ? 'noindex,follow' : 'index,follow',
  }), [hasError])
  usePageMetadata(metadata)

  useEffect(() => {
    if (request.state !== 'ready' || items.length === 0) return undefined
    let opener = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lightbox = GLightbox({
      selector: '.gallery-lightbox',
      keyboardNavigation: true,
      touchNavigation: true,
      loop: false,
      openEffect: reducedMotion ? 'none' : 'fade',
      closeEffect: reducedMotion ? 'none' : 'fade',
      slideEffect: reducedMotion ? 'none' : 'slide',
      onOpen() {
        opener = document.activeElement
        const modal = document.getElementById('glightbox-body')
        modal?.setAttribute('aria-modal', 'true')
        modal?.setAttribute('aria-label', 'Prohlížeč galerie Moniké')
        const close = modal?.querySelector('.gclose')
        const previous = modal?.querySelector('.gprev')
        const next = modal?.querySelector('.gnext')
        close?.setAttribute('aria-label', 'Zavřít galerii')
        previous?.setAttribute('aria-label', 'Předchozí obrázek')
        next?.setAttribute('aria-label', 'Další obrázek')
        close?.focus()
      },
      onClose() {
        opener?.focus?.()
        opener = null
      },
    })
    return () => lightbox.destroy()
  }, [items, request.state])

  return (
    <PublicFrame title="Galerie">
      <PublicRequestState
        state={state}
        emptyMessage="Galerie zatím neobsahuje žádné publikované položky."
        onRetry={request.retry}
        retrying={request.retrying}
      >
        <div className="gallery-grid">
          {items.map((item) => {
            const grid = imageProps(item, 'gallery-grid')
            const full = imageProps(item, 'gallery-lightbox')
            return (
              <a
                key={item.id}
                className="gallery-item gallery-lightbox"
                href={full.src}
                data-srcset={full.srcSet}
                data-sizes={full.sizes}
                data-gallery="monike"
                data-title={item.title}
                data-description={item.caption || ''}
                data-alt={item.alt_text || item.title}
                aria-label={`Otevřít obrázek: ${item.title}`}
              >
                <ImageWithFallback
                  {...grid}
                  alt={item.alt_text || item.title}
                  fallbackLabel={`${item.title} — obrázek se nepodařilo načíst.`}
                />
                <span>{item.title}</span>
              </a>
            )
          })}
        </div>
      </PublicRequestState>
    </PublicFrame>
  )
}
