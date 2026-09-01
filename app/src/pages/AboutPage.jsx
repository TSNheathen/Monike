import { useMemo } from 'react'
import { PublicFrame } from '../components/SiteFrame.jsx'
import { ImageWithFallback, PublicRequestState } from '../components/PublicContent.jsx'
import { loadAboutPage } from '../data/public-content.js'
import { usePublicResource } from '../hooks/usePublicResource.js'
import { usePageMetadata } from '../hooks/usePageMetadata.js'
import { pageMetadata } from '../lib/metadata.js'
import { pb } from '../lib/pocketbase.js'
import { responsiveImage } from '../lib/media.js'

function portraitProps(record) {
  if (record.portrait.startsWith('/')) {
    return { src: record.portrait, width: record.portrait_width, height: record.portrait_height, loading: 'eager' }
  }
  return responsiveImage(pb, {
    record,
    field: 'portrait',
    widthField: 'portrait_width',
    heightField: 'portrait_height',
    role: 'about-portrait',
  })
}

export default function AboutPage() {
  const request = usePublicResource(loadAboutPage)
  const record = request.state === 'ready' ? request.data : null
  const hasError = ['unavailable', 'error', 'configuration'].includes(request.state)
  const metadata = useMemo(() => pageMetadata({
    title: 'O mně | Moniké',
    description: 'Poznej autorku Moniké, její tvorbu, cesty a příběhy.',
    path: '/o-mne',
    robots: hasError ? 'noindex,follow' : 'index,follow',
  }), [hasError])
  usePageMetadata(metadata)

  return (
    <PublicFrame title="O mně">
      <PublicRequestState state={request.state} onRetry={request.retry} retrying={request.retrying}>
        {record && (
          <article className="about-layout">
            <ImageWithFallback
              className="about-portrait"
              {...portraitProps(record)}
              alt={record.portrait_alt}
              fallbackLabel="Portrét se nepodařilo načíst."
            />
            <div className="rich-content" dangerouslySetInnerHTML={{ __html: record.content_html }} />
          </article>
        )}
      </PublicRequestState>
    </PublicFrame>
  )
}
