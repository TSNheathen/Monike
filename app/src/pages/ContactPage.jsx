import { useMemo } from 'react'
import { Facebook, Instagram, Mail } from 'lucide-react'
import { PublicFrame } from '../components/SiteFrame.jsx'
import { PublicRequestState } from '../components/PublicContent.jsx'
import { loadContact } from '../data/public-content.js'
import { usePublicResource } from '../hooks/usePublicResource.js'
import { usePageMetadata } from '../hooks/usePageMetadata.js'
import { pageMetadata } from '../lib/metadata.js'

export default function ContactPage() {
  const request = usePublicResource(loadContact)
  const record = request.state === 'ready' ? request.data : null
  const hasError = ['unavailable', 'error', 'configuration'].includes(request.state)
  const metadata = useMemo(() => pageMetadata({
    title: 'Kontakt | Moniké',
    description: 'Spoj se s Moniké e-mailem nebo přes sociální sítě.',
    path: '/kontakt',
    robots: hasError ? 'noindex,follow' : 'index,follow',
  }), [hasError])
  usePageMetadata(metadata)

  return (
    <PublicFrame title="Kontakt">
      <PublicRequestState state={request.state} onRetry={request.retry} retrying={request.retrying}>
        {record && (
          <section className="contact-panel" aria-label="Kontaktní údaje">
            <p>{record.contact_intro}</p>
            <ul className="contact-list">
              <li><a href={`mailto:${record.contact_email}`}><Mail aria-hidden="true" />{record.contact_email}</a></li>
              <li><a href={record.instagram_url} rel="noreferrer"><Instagram aria-hidden="true" />Instagram</a></li>
              <li><a href={record.facebook_url} rel="noreferrer"><Facebook aria-hidden="true" />Facebook</a></li>
            </ul>
          </section>
        )}
      </PublicRequestState>
    </PublicFrame>
  )
}
