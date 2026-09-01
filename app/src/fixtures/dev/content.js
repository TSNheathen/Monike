import { DEV_FIXTURES_ENABLED } from '../../config/environment.js'
import { categoryCards } from '../../data/landing.js'

const posts = Object.freeze([
  Object.freeze({
    id: 'demo-cesty',
    title: 'První zápisky z cest',
    slug: 'prvni-zapisky-z-cest',
    categories: ['cesty'],
    excerpt: 'Krátké ohlédnutí za místy, která ve mně zůstala.',
    published_at: '2026-06-10',
    content_html:
      '<p>Tohle je vývojová ukázka. Po připojení PocketBase se zde zobrazí publikované příspěvky z administrace.</p>',
  }),
])

const gallery = Object.freeze(
  categoryCards.map((card, index) =>
    Object.freeze({
      id: card.title,
      title: card.title,
      caption: card.description,
      alt_text: card.description,
      image: card.image,
      sort_order: index + 1,
    }),
  ),
)

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
  categoryCards.map((card) => Object.freeze({
    id: `dev-${card.slot}`,
    slot: card.slot,
    title: card.title,
    description: card.description,
    image: card.image,
    image_width: 1024,
    image_height: 1536,
  })),
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
  gallery: DEV_FIXTURES_ENABLED ? gallery : Object.freeze([]),
  siteContent: DEV_FIXTURES_ENABLED ? siteContent : null,
  landingCards: DEV_FIXTURES_ENABLED ? landingCards : Object.freeze([]),
  aboutPage: DEV_FIXTURES_ENABLED ? aboutPage : null,
})
