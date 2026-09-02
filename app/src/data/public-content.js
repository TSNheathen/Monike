import { DEV_FIXTURES_ENABLED } from '../config/environment.js'
import { configurationError, MonikeApiError, API_ERROR_KINDS } from '../lib/api-errors.js'
import { api } from '../lib/pocketbase.js'
import { LANDING_CARD_SLOTS, landingCardHref } from './landing.js'
import { devContentFixtures } from '../fixtures/dev/content.js'

function requireRecord(record, name) {
  if (!record) throw configurationError(`Povinný záznam ${name} chybí.`)
  return record
}

export async function loadLandingContent() {
  const [site, cards] = DEV_FIXTURES_ENABLED
    ? [devContentFixtures.siteContent, devContentFixtures.landingCards]
    : await Promise.all([api.siteContent(), api.landingCards()])

  requireRecord(site, 'site_content[key=main]')
  const bySlot = new Map(cards.map((card) => [card.slot, card]))
  if (cards.length !== LANDING_CARD_SLOTS.length || LANDING_CARD_SLOTS.some(({ slot }) => !bySlot.has(slot))) {
    throw configurationError('Landing page musí obsahovat právě pět pevných karet.')
  }

  return {
    site,
    cards: LANDING_CARD_SLOTS.map((definition) => ({
      ...bySlot.get(definition.slot),
      href: landingCardHref(bySlot.get(definition.slot)),
    })),
  }
}

export async function loadLandingNavigation() {
  return DEV_FIXTURES_ENABLED ? devContentFixtures.landingCards : api.landingCards()
}

export async function loadBlogLabels() {
  return DEV_FIXTURES_ENABLED ? devContentFixtures.blogLabels : api.blogLabels()
}

export async function loadPosts(labelId = null) {
  if (!DEV_FIXTURES_ENABLED) return api.posts(true, labelId)
  return labelId
    ? devContentFixtures.posts.filter((post) => post.labels?.includes(labelId))
    : devContentFixtures.posts
}

export async function loadBlogListing(labelSlug = null) {
  const labels = await loadBlogLabels()
  const selectedLabel = labelSlug
    ? labels.find((label) => label.slug === labelSlug) || null
    : null
  if (labelSlug && !selectedLabel) {
    return { kind: 'invalid', labels, selectedLabel: null, posts: [] }
  }
  return {
    kind: 'ready',
    labels,
    selectedLabel,
    posts: await loadPosts(selectedLabel?.id || null),
  }
}

export async function loadArticle(slug) {
  if (!DEV_FIXTURES_ENABLED) return api.postBySlug(slug)
  const record = devContentFixtures.posts.find((post) => post.slug === slug)
  if (!record) {
    throw new MonikeApiError(API_ERROR_KINDS.NOT_FOUND, 'Článek nebyl nalezen.', { status: 404 })
  }
  return { kind: 'canonical', record }
}

export async function loadArticlePage(slug) {
  const [result, labels] = await Promise.all([loadArticle(slug), loadBlogLabels()])
  return { result, labels }
}

export async function loadGallery() {
  return api.gallery(true)
}

export async function loadAboutPage() {
  const record = DEV_FIXTURES_ENABLED ? devContentFixtures.aboutPage : await api.aboutPage()
  requireRecord(record, 'about_page[key=main]')
  if (
    !record.portrait ||
    !record.portrait_alt?.trim() ||
    Number(record.portrait_width) < 1 ||
    Number(record.portrait_height) < 1 ||
    record.content_json?.type !== 'doc' ||
    typeof record.content_html !== 'string'
  ) {
    throw configurationError('Stránka O mně nemá povinný portrét nebo platný obsah.')
  }
  return record
}

export async function loadContact() {
  const record = DEV_FIXTURES_ENABLED ? devContentFixtures.siteContent : await api.siteContent()
  requireRecord(record, 'site_content[key=main]')
  if (
    !record.contact_intro?.trim() ||
    !record.contact_email?.trim() ||
    !record.instagram_url ||
    !record.facebook_url
  ) {
    throw configurationError('Kontaktní stránka nemá všechny povinné hodnoty.')
  }
  return record
}
