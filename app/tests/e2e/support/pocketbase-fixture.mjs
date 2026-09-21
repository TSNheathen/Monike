import PocketBase from 'pocketbase'
import {
  TEST_ADMIN,
  TEST_POCKETBASE_URL,
  TEST_POST,
  TEST_SUPERUSER,
} from './test-data.mjs'

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

async function deleteAll(client, collectionName) {
  const records = await client.collection(collectionName).getFullList({ batch: 200 })
  for (const record of records) {
    await client.collection(collectionName).delete(record.id)
  }
}

export async function resetPocketBaseFixture() {
  const client = new PocketBase(TEST_POCKETBASE_URL)
  await client
    .collection('_superusers')
    .authWithPassword(TEST_SUPERUSER.email, TEST_SUPERUSER.password)

  await deleteAll(client, 'content_assets')
  await deleteAll(client, 'gallery_images')
  await deleteAll(client, 'posts')
  await deleteAll(client, 'admins')

  await client.collection('admins').create({
    email: TEST_ADMIN.email,
    password: TEST_ADMIN.password,
    passwordConfirm: TEST_ADMIN.password,
    verified: true,
  })

  const labels = await client.collection('blog_labels').getFullList({ sort: 'sort_order' })
  const cesty = labels.find((label) => label.slug === 'cesty')
  if (!cesty) throw new Error('Seed label cesty chybí.')

  const about = await client
    .collection('about_page')
    .getFirstListItem(client.filter('key = {:key}', { key: 'main' }))
  await client.collection('about_page').update(about.id, {
    portrait: new File([onePixelPng], 'portrait.png', { type: 'image/png' }),
    portrait_alt: 'Testovací portrét autorky Moniké',
    content_json: { type: 'doc', content: [{ type: 'paragraph' }] },
    content_html: '<p></p>',
  })

  const site = await client
    .collection('site_content')
    .getFirstListItem(client.filter('key = {:key}', { key: 'main' }))
  await client.collection('site_content').update(site.id, {
    landing_background: '',
    hero_subtitle: 'Tvořím. Cestuji. Žiju.',
    hero_body:
      'Umění je můj jazyk.\nCestování moje inspirace.\nOkamžiky moje vzpomínky.\nTady sdílím vše, co tvoří můj svět.',
    hero_cta_label: 'VSTOUPIT DO MÉHO SVĚTA',
    signature_text: 'Collect moments, not things',
    contact_intro: 'Napiš mi e-mailem nebo přes sociální sítě.',
    contact_email: 'monike@example.com',
    instagram_url: 'https://www.instagram.com/',
    facebook_url: 'https://www.facebook.com/',
  })

  await client.collection('posts').create({
    ...TEST_POST,
    labels: [cesty.id],
    content_html: '<p>Testovací obsah z lokálního PocketBase.</p>',
    content_json: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Testovací obsah z lokálního PocketBase.' }],
        },
      ],
    },
    published: true,
    published_at: '2026-09-01 12:00:00.000Z',
  })

  const galleryData = new FormData()
  galleryData.set('title', 'Testovací obrázek')
  galleryData.set('alt_text', 'Jednobarevný testovací bod')
  galleryData.set('caption', 'Deterministická testovací galerie')
  galleryData.set('sort_order', '1')
  galleryData.set('published', 'true')
  galleryData.set(
    'image',
    new File([onePixelPng], 'test-image.png', { type: 'image/png' }),
  )
  await client.collection('gallery_images').create(galleryData)

  client.authStore.clear()
}

export async function authenticateTestAdmin() {
  const client = new PocketBase(TEST_POCKETBASE_URL)
  await client
    .collection('admins')
    .authWithPassword(TEST_ADMIN.email, TEST_ADMIN.password)
  return client
}

export async function authenticateTestSuperuser() {
  const client = new PocketBase(TEST_POCKETBASE_URL)
  await client
    .collection('_superusers')
    .authWithPassword(TEST_SUPERUSER.email, TEST_SUPERUSER.password)
  return client
}

export async function loginAsTestAdmin(page) {
  await page.goto('/admin/login')
  await page.getByLabel('E-mail').fill(TEST_ADMIN.email)
  await page.getByLabel('Heslo').fill(TEST_ADMIN.password)
  await page.getByRole('button', { name: 'Přihlásit' }).click()
  await page.waitForURL('**/admin/blog')
}
