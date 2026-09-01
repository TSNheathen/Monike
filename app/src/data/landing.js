export const navItems = [
  { label: 'DOMŮ', href: '/' },
  { label: 'GALERIE', href: '/gallery' },
  { label: 'CESTY & PŘÍBĚHY', href: '/blog?category=cesty' },
  { label: 'O MNĚ', href: '/o-mne' },
  { label: 'KOČIČKY & ANDY', href: '/blog?category=kocicky-andy' },
  { label: 'KONTAKT', href: '/kontakt' },
]

export const categoryCards = [
  {
    title: 'GALERIE',
    description: 'Obrazy, kresby, portréty, ilustrace a další tvorba',
    href: '/gallery',
    image: '/assets/landing/card-galerie.png',
  },
  {
    title: 'CESTY & PŘÍBĚHY',
    description: 'Zážitky, příběhy a fotografie z celého světa',
    href: '/blog?category=cesty',
    image: '/assets/landing/card-cesty-pribehy.png',
  },
  {
    title: 'VZPOMÍNKY',
    description: 'Nezapomenutelné okamžiky, které si nesu srdcem',
    href: '/blog?category=vzpominky',
    image: '/assets/landing/card-vzpominky.png',
  },
  {
    title: 'KOČIČKY & ANDY',
    description: 'Moje chlupaté parťačky a můj papoušek Andy',
    href: '/blog?category=kocicky-andy',
    image: '/assets/landing/card-kocicky-andy.png',
  },
  {
    title: 'PROCES TVORBY',
    description: 'Jak vznikají má díla, inspirace, myšlenky a zákulisí tvorby',
    href: '/blog?category=proces-tvorby',
    image: '/assets/landing/card-proces-tvorby.png',
  },
]

export const samplePosts = [
  {
    id: 'demo-cesty',
    title: 'První zápisky z cest',
    slug: 'prvni-zapisky-z-cest',
    excerpt: 'Krátké ohlédnutí za místy, která ve mně zůstala.',
    published_at: '2026-06-10',
    content_html:
      '<p>Tohle je ukázkový článek. Po připojení PocketBase se zde zobrazí publikované příspěvky z administrace.</p>',
  },
]

export const sampleGallery = categoryCards.map((card, index) => ({
  id: card.title,
  title: card.title,
  caption: card.description,
  alt_text: card.description,
  image: card.image,
  sort_order: index + 1,
}))
