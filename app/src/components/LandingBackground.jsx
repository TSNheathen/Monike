import { useState } from 'react'
import { pb } from '../lib/pocketbase.js'
import { responsiveImage } from '../lib/media.js'

export default function LandingBackground({ site }) {
  const [failedFile, setFailedFile] = useState(null)
  let image = null
  if (site?.landing_background && site.landing_background !== failedFile) {
    try {
      image = responsiveImage(pb, {
        record: site,
        field: 'landing_background',
        widthField: 'background_width',
        heightField: 'background_height',
        role: 'landing-background',
      })
    } catch {
      // The original artwork remains the decorative default without a CMS image.
    }
  }
  return (
    <picture className="landing-background" aria-hidden="true">
      {image ? (
        <img {...image} alt="" onError={() => setFailedFile(site.landing_background)} />
      ) : (
        <>
          <source media="(max-width: 720px)" srcSet="/assets/landing/background-mobile.png" />
          <img src="/assets/landing/background-desktop.png" alt="" />
        </>
      )}
    </picture>
  )
}
