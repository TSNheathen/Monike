import { expect, test } from '@playwright/test'
import {
  authenticateTestAdmin,
  authenticateTestSuperuser,
  resetPocketBaseFixture,
} from './support/pocketbase-fixture.mjs'
import {
  TEST_POCKETBASE_URL,
  TEST_POST,
} from './support/test-data.mjs'

const categoryKeys = ['cesty', 'vzpominky', 'kocicky-andy', 'proces-tvorby']

function field(collection, name) {
  return collection.fields.find((item) => item.name === name)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await resetPocketBaseFixture()
})

test('má pevné kategorie, indexy, chráněná média a osmihodinový auth token', async () => {
  const client = await authenticateTestSuperuser()
  const [admins, posts, gallery, assets] = await Promise.all([
    client.collections.getOne('admins'),
    client.collections.getOne('posts'),
    client.collections.getOne('gallery_images'),
    client.collections.getOne('content_assets'),
  ])

  expect(admins.authToken.duration).toBe(28_800)
  expect(admins.listRule).toBeNull()
  expect(admins.createRule).toBeNull()
  expect(admins.updateRule).toBeNull()
  expect(field(admins, 'password').min).toBe(16)

  expect(field(posts, 'categories')).toMatchObject({
    required: true,
    maxSelect: 4,
    values: categoryKeys,
  })
  expect(field(posts, 'cover_image')).toMatchObject({
    protected: true,
    thumbs: ['480x0', '800x0', '1200x0', '1600x0', '2400x0', '1200x630'],
  })
  expect(posts.createRule).toBeNull()
  expect(posts.deleteRule).toBeNull()
  expect(posts.updateRule).toContain('@request.body.content_html:isset = false')
  expect(field(gallery, 'image')).toMatchObject({
    protected: true,
    thumbs: ['480x600', '800x1000', '1200x0', '1600x0', '2400x0'],
  })
  expect(field(assets, 'image')).toMatchObject({
    protected: true,
    thumbs: ['480x0', '800x0', '1200x0', '1600x0'],
  })
  expect(assets.createRule).toBeNull()
  expect(assets.updateRule).toBeNull()
  expect(assets.deleteRule).toBeNull()
  expect(assets.viewRule).toContain('active = true')
  expect(assets.viewRule).toContain('post.published = true')
  expect(posts.indexes.join('\n')).toContain('idx_posts_public_listing')
  expect(gallery.indexes.join('\n')).toContain('idx_gallery_public_order')
})

test('seeduje právě singletony a pět neměnných slotů', async () => {
  const guest = await fetch(`${TEST_POCKETBASE_URL}/api/collections/site_content/records`)
  const site = await guest.json()
  expect(guest.status).toBe(200)
  expect(site.items).toHaveLength(1)
  expect(site.items[0].key).toBe('main')

  const cardsResponse = await fetch(
    `${TEST_POCKETBASE_URL}/api/collections/landing_cards/records?perPage=20`,
  )
  const cards = await cardsResponse.json()
  expect(cards.items.map((item) => item.slot).sort()).toEqual(
    ['gallery', ...categoryKeys].sort(),
  )
  expect(cards.items).toHaveLength(5)
  for (const card of cards.items) {
    expect(card.image).not.toBe('')
    expect(card.image_width).toBe(1024)
    expect(card.image_height).toBe(1536)
  }

  const aboutResponse = await fetch(
    `${TEST_POCKETBASE_URL}/api/collections/about_page/records`,
  )
  const about = await aboutResponse.json()
  expect(about.items).toHaveLength(1)
  expect(about.items[0].key).toBe('main')

  const client = await authenticateTestAdmin()
  await expect(
    client.collection('landing_cards').update(cards.items[0].id, { slot: 'jiny-slot' }),
  ).rejects.toMatchObject({ status: 404 })
  await expect(
    client.collection('site_content').delete(site.items[0].id),
  ).rejects.toMatchObject({ status: 403 })
})

test('nepovolí veřejné zápisy ani neaktivní chráněný soubor', async () => {
  const anonymousCreate = await fetch(
    `${TEST_POCKETBASE_URL}/api/collections/posts/records`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Nepovolený článek',
        slug: 'nepovoleny-clanek',
        categories: ['cesty'],
      }),
    },
  )
  expect(anonymousCreate.status).toBe(403)

  const superuser = await authenticateTestSuperuser()
  const post = await superuser
    .collection('posts')
    .getFirstListItem(superuser.filter('slug = {:slug}', { slug: TEST_POST.slug }))
  const image = new File(
    [
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    ],
    'inactive.png',
    { type: 'image/png' },
  )
  const asset = await superuser.collection('content_assets').create({
    image,
    post: post.id,
    active: false,
    width: 1,
    height: 1,
  })
  const fileUrl = superuser.files.getURL(asset, asset.image)

  const guestFile = await fetch(fileUrl)
  expect(guestFile.status).toBe(404)
  const guestRecord = await fetch(
    `${TEST_POCKETBASE_URL}/api/collections/content_assets/records/${asset.id}`,
  )
  expect(guestRecord.status).toBe(404)

  await superuser.collection('content_assets').update(asset.id, { active: true })
  expect((await fetch(fileUrl)).status).toBe(200)
  expect((await fetch(
    `${TEST_POCKETBASE_URL}/api/collections/content_assets/records/${asset.id}`,
  )).status).toBe(200)
})
