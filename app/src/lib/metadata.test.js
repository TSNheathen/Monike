import { absoluteSiteUrl, applyPageMetadata, pageMetadata } from './metadata.js'

describe('metadata veřejných tras', () => {
  it('staví kanonické URL pouze z nakonfigurovaného originu', () => {
    expect(absoluteSiteUrl('/blog?label=cesty')).toBe(
      'http://127.0.0.1:5173/blog?label=cesty',
    )
  })

  it('nastaví title, canonical, robots a sdílecí metadata', () => {
    const metadata = pageMetadata({
      title: 'Blog | Moniké',
      description: 'Články Moniké.',
      path: '/blog',
    })
    applyPageMetadata(metadata)

    expect(document.title).toBe('Blog | Moniké')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://127.0.0.1:5173/blog',
    )
    expect(document.querySelector('meta[property="og:locale"]')).toHaveAttribute('content', 'cs_CZ')
    expect(document.querySelector('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  })

  it('pro neplatnou trasu odstraní canonical a obsahová OG URL', () => {
    applyPageMetadata(pageMetadata({
      title: 'Stránka nenalezena | Moniké',
      description: 'Stránka nebyla nalezena.',
      path: '/chyba',
      canonical: false,
      robots: 'noindex,follow',
      image: null,
    }))
    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.querySelector('meta[property="og:url"]')).toBeNull()
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
  })
})
