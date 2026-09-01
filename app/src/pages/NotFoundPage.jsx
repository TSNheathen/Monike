import { Link } from 'react-router-dom'
import { PublicFrame } from '../components/SiteFrame.jsx'
import { StatePanel } from '../components/AsyncState.jsx'
import { usePageMetadata } from '../hooks/usePageMetadata.js'
import { pageMetadata } from '../lib/metadata.js'

const METADATA = pageMetadata({
  title: 'Stránka nenalezena | Moniké',
  description: 'Požadovaná stránka nebyla nalezena.',
  path: '/',
  canonical: false,
  robots: 'noindex,follow',
  image: null,
})

export default function NotFoundPage() {
  usePageMetadata(METADATA)
  return (
    <PublicFrame title="Stránka nenalezena">
      <StatePanel state="not-found" title="Stránka nebyla nalezena.">
        <p><Link to="/">Vrátit se domů</Link></p>
      </StatePanel>
    </PublicFrame>
  )
}
