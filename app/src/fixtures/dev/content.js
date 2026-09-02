import { DEV_FIXTURES_ENABLED } from '../../config/environment.js'
import { categoryCards } from '../../data/landing.js'

const blogLabels = Object.freeze([
  Object.freeze({ id: 'labelcesty00001', name: 'Cesty & příběhy', slug: 'cesty', color: '#B88A36', sort_order: 10 }),
  Object.freeze({ id: 'labelvzpom00001', name: 'Vzpomínky', slug: 'vzpominky', color: '#9D6B53', sort_order: 20 }),
  Object.freeze({ id: 'labelkocky00001', name: 'Kočičky & Andy', slug: 'kocicky-andy', color: '#7D8C72', sort_order: 30 }),
  Object.freeze({ id: 'labelproces0001', name: 'Proces tvorby', slug: 'proces-tvorby', color: '#806B9B', sort_order: 40 }),
])

const posts = Object.freeze([
  Object.freeze({
    id: 'demo-cesty',
    title: 'První zápisky z cest',
    slug: 'prvni-zapisky-z-cest',
    labels: [blogLabels[0].id],
    expand: { labels: [blogLabels[0]] },
    excerpt: 'Krátké ohlédnutí za místy, která ve mně zůstala.',
    published_at: '2026-06-10',
    content_html:
      '<p>Tohle je vývojová ukázka. Po připojení PocketBase se zde zobrazí publikované příspěvky z administrace.</p>',
  }),
])

const siteContent = Object.freeze({
  id: 'dev-site-main',
  key: 'main',
  hero_subtitle: 'Tvořím. Cestuji. Žiju.',
  hero_body: 'Umění je můj jazyk.\nCestování moje inspirace.\nOkamžiky moje vzpomínky.\nTady sdílím vše, co tvoří můj svět.',
  hero_cta_label: 'VSTOUPIT DO MÉHO SVĚTA',
  signature_text: 'Collect moments, not things',
  contact_intro: 'Napiš mi e-mailem nebo přes sociální sítě.',
  contact_email: 'monike@example.com',
  instagram_url: 'https://www.instagram.com/',
  facebook_url: 'https://www.facebook.com/',
})

const landingCards = Object.freeze(
  categoryCards.map((card) => {
    const label = blogLabels.find((item) => item.slug === card.slot) || null
    return Object.freeze({
      id: `dev-${card.slot}`,
      slot: card.slot,
      title: card.title,
      description: card.description,
      image: card.image,
      image_width: 1024,
      image_height: 1536,
      label: label?.id || '',
      expand: label ? { label } : {},
    })
  }),
)

const aboutPage = Object.freeze({
  id: 'dev-about-main',
  key: 'main',
  portrait: '/assets/landing/card-proces-tvorby.png',
  portrait_alt: 'Portrét autorky Moniké',
  portrait_width: 1024,
  portrait_height: 1536,
  content_json: { type: 'doc', content: [{ type: 'paragraph' }] },
  content_html: '<p>Vítej v mém světě tvorby, cest a příběhů.</p>',
})

export const devContentFixtures = Object.freeze({
  enabled: DEV_FIXTURES_ENABLED,
  posts: DEV_FIXTURES_ENABLED ? posts : Object.freeze([]),
  blogLabels: DEV_FIXTURES_ENABLED ? blogLabels : Object.freeze([]),
  siteContent: DEV_FIXTURES_ENABLED ? siteContent : null,
  landingCards: DEV_FIXTURES_ENABLED ? landingCards : Object.freeze([]),
  aboutPage: DEV_FIXTURES_ENABLED ? aboutPage : null,
})
