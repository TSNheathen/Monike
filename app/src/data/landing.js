import { getBlogCategory } from '../config/categories.js'

const cesty = getBlogCategory('cesty')
const vzpominky = getBlogCategory('vzpominky')
const kocickyAndy = getBlogCategory('kocicky-andy')
const procesTvorby = getBlogCategory('proces-tvorby')

export const navItems = [
  { label: 'DOMŮ', href: '/' },
  { label: 'GALERIE', href: '/gallery' },
  { label: cesty.label.toLocaleUpperCase('cs-CZ'), href: `/blog?category=${cesty.key}` },
  { label: 'O MNĚ', href: '/o-mne' },
  {
    label: kocickyAndy.label.toLocaleUpperCase('cs-CZ'),
    href: `/blog?category=${kocickyAndy.key}`,
  },
  { label: 'KONTAKT', href: '/kontakt' },
]

export const LANDING_CARD_SLOTS = Object.freeze([
  Object.freeze({ slot: 'gallery', href: '/gallery' }),
  Object.freeze({ slot: cesty.key, href: `/blog?category=${cesty.key}` }),
  Object.freeze({ slot: vzpominky.key, href: `/blog?category=${vzpominky.key}` }),
  Object.freeze({ slot: kocickyAndy.key, href: `/blog?category=${kocickyAndy.key}` }),
  Object.freeze({ slot: procesTvorby.key, href: `/blog?category=${procesTvorby.key}` }),
])

export const categoryCards = [
  {
    slot: 'gallery',
    title: 'GALERIE',
    description: 'Obrazy, kresby, portréty, ilustrace a další tvorba',
    href: '/gallery',
    image: '/assets/landing/card-galerie.png',
  },
  {
    slot: cesty.key,
    title: cesty.label.toLocaleUpperCase('cs-CZ'),
    description: 'Zážitky, příběhy a fotografie z celého světa',
    href: `/blog?category=${cesty.key}`,
    image: '/assets/landing/card-cesty-pribehy.png',
  },
  {
    slot: vzpominky.key,
    title: vzpominky.label.toLocaleUpperCase('cs-CZ'),
    description: 'Nezapomenutelné okamžiky, které si nesu srdcem',
    href: `/blog?category=${vzpominky.key}`,
    image: '/assets/landing/card-vzpominky.png',
  },
  {
    slot: kocickyAndy.key,
    title: kocickyAndy.label.toLocaleUpperCase('cs-CZ'),
    description: 'Moje chlupaté parťačky a můj papoušek Andy',
    href: `/blog?category=${kocickyAndy.key}`,
    image: '/assets/landing/card-kocicky-andy.png',
  },
  {
    slot: procesTvorby.key,
    title: procesTvorby.label.toLocaleUpperCase('cs-CZ'),
    description: 'Jak vznikají má díla, inspirace, myšlenky a zákulisí tvorby',
    href: `/blog?category=${procesTvorby.key}`,
    image: '/assets/landing/card-proces-tvorby.png',
  },
]
