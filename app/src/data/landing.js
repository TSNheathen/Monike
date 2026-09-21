export const LANDING_CARD_SLOTS = Object.freeze([
  Object.freeze({ slot: 'gallery' }),
  Object.freeze({ slot: 'cesty' }),
  Object.freeze({ slot: 'vzpominky' }),
  Object.freeze({ slot: 'kocicky-andy' }),
  Object.freeze({ slot: 'proces-tvorby' }),
])

export function expandedLabel(record) {
  const value = record?.expand?.label
  return Array.isArray(value) ? value[0] || null : value || null
}

export function landingCardHref(card) {
  if (card.slot === 'gallery') return '/gallery'
  const label = expandedLabel(card)
  return label?.slug ? `/blog?label=${encodeURIComponent(label.slug)}` : '/blog'
}

export function landingCardTitle(card) {
  return expandedLabel(card)?.name || card.title
}

export function landingNavigation(labels = []) {
  return [
    { label: 'DOMŮ', href: '/' },
    { label: 'Blog', href: '/blog', labels },
    { label: 'GALERIE', href: '/gallery' },
    { label: 'O MNĚ', href: '/o-mne' },
    { label: 'KONTAKT', href: '/kontakt' },
  ]
}

export const categoryCards = [
  {
    slot: 'gallery',
    title: 'GALERIE',
    description: 'Obrazy, kresby, portréty, ilustrace a další tvorba',
    image: '/assets/landing/card-galerie.png',
  },
  {
    slot: 'cesty',
    title: 'CESTY & PŘÍBĚHY',
    description: 'Zážitky, příběhy a fotografie z celého světa',
    image: '/assets/landing/card-cesty-pribehy.png',
  },
  {
    slot: 'vzpominky',
    title: 'VZPOMÍNKY',
    description: 'Nezapomenutelné okamžiky, které si nesu srdcem',
    image: '/assets/landing/card-vzpominky.png',
  },
  {
    slot: 'kocicky-andy',
    title: 'KOČIČKY & ANDY',
    description: 'Moje chlupaté parťačky a můj papoušek Andy',
    image: '/assets/landing/card-kocicky-andy.png',
  },
  {
    slot: 'proces-tvorby',
    title: 'PROCES TVORBY',
    description: 'Jak vznikají má díla, inspirace, myšlenky a zákulisí tvorby',
    image: '/assets/landing/card-proces-tvorby.png',
  },
]
