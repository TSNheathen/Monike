import { expect, test } from '@playwright/test'
import {
  authenticateTestSuperuser,
  resetPocketBaseFixture,
} from './support/pocketbase-fixture.mjs'
import { TEST_ADMIN, TEST_POCKETBASE_URL, TEST_POST } from './support/test-data.mjs'

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await resetPocketBaseFixture()
})

test('filter-looking slug payloads nikdy nerozšíří article resolver', async () => {
  for (const payload of [
    "' || published = true",
    'deterministicky\\test',
    'slug && labels:length > 0',
    'x") || (id != "',
  ]) {
    const response = await fetch(
      `${TEST_POCKETBASE_URL}/api/monike/articles/${encodeURIComponent(payload)}`,
    )
    expect(response.status, payload).toBe(404)
    expect(await response.text()).not.toContain(TEST_POST.title)
  }

  const canonical = await fetch(`${TEST_POCKETBASE_URL}/api/monike/articles/${TEST_POST.slug}`)
  expect(canonical.status).toBe(200)
})

test('šestý rychlý přihlašovací pokus aktivuje skutečný PocketBase rate limit', async () => {
  const superuser = await authenticateTestSuperuser()
  const settings = await superuser.settings.getAll()
  const originalRateLimits = settings.rateLimits
  await superuser.settings.update({
    rateLimits: {
      enabled: true,
      rules: [{ label: '*:auth', audience: '@guest', duration: 60, maxRequests: 5 }],
    },
  })

  try {
    const statuses = []
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await fetch(
        `${TEST_POCKETBASE_URL}/api/collections/admins/auth-with-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: TEST_ADMIN.email, password: 'nespravne-heslo' }),
        },
      )
      statuses.push(response.status)
    }
    expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400])
    expect(statuses[5]).toBe(429)
  } finally {
    await superuser.settings.update({ rateLimits: originalRateLimits })
    superuser.authStore.clear()
  }
})

test('CORS vrací jen přesný lokální frontend origin', async () => {
  const allowedOrigin = 'http://127.0.0.1:4173'
  const allowed = await fetch(`${TEST_POCKETBASE_URL}/api/health`, {
    headers: { Origin: allowedOrigin },
  })
  expect(allowed.headers.get('access-control-allow-origin')).toBe(allowedOrigin)

  for (const origin of ['https://evil.example', 'https://demo.monike.example']) {
    const denied = await fetch(`${TEST_POCKETBASE_URL}/api/health`, {
      headers: { Origin: origin },
    })
    expect(denied.headers.get('access-control-allow-origin')).toBeNull()
  }
})

test('server odmítne rich-text XSS struktury a escapuje útočný text', async () => {
  const superuser = await authenticateTestSuperuser()
  await superuser.collection('admins').authWithPassword(TEST_ADMIN.email, TEST_ADMIN.password)
  const cesty = await superuser.collection('blog_labels').getFirstListItem('slug = "cesty"')

  async function save(contentJson, slug) {
    return fetch(`${TEST_POCKETBASE_URL}/api/monike/posts/save`, {
      method: 'POST',
      headers: {
        Authorization: superuser.authStore.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Bezpečnostní test',
        slug,
        excerpt: '',
        labels: [cesty.id],
        content_json: contentJson,
        published: true,
      }),
    })
  }

  for (const [slug, node] of [
    ['xss-iframe', { type: 'iframe', attrs: { src: 'https://evil.example' } }],
    ['xss-object', { type: 'object', attrs: { data: 'https://evil.example' } }],
    ['xss-style', { type: 'paragraph', attrs: { style: 'position:fixed' } }],
    ['xss-image', { type: 'image', attrs: { src: 'data:image/png;base64,abc', onerror: 'alert(1)' } }],
    ['xss-link', {
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'odkaz',
        marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
      }],
    }],
  ]) {
    const response = await save({ type: 'doc', content: [node] }, slug)
    expect(response.status, slug).toBe(400)
  }

  const safe = await save({
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: '<script>alert(1)</script><img onerror="alert(2)">' }],
    }],
  }, 'xss-escapovany-text')
  expect(safe.status).toBe(200)
  const saved = await safe.json()
  expect(saved.record.content_html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  expect(saved.record.content_html).not.toMatch(/<script|<img|onerror="/i)
})

test('draft/protected soubor je guestovi nedostupný a odpověď není veřejně cacheovatelná', async () => {
  const superuser = await authenticateTestSuperuser()
  const cesty = await superuser.collection('blog_labels').getFirstListItem('slug = "cesty"')
  const draft = await superuser.collection('posts').create({
    title: 'Soukromý koncept',
    slug: 'soukromy-koncept',
    excerpt: '',
    labels: [cesty.id],
    content_json: { type: 'doc', content: [{ type: 'paragraph' }] },
    content_html: '<p></p>',
    published: false,
    cover_image: new File(
      [Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')],
      'draft.png',
      { type: 'image/png' },
    ),
  })
  const fileUrl = superuser.files.getURL(draft, draft.cover_image)
  superuser.authStore.clear()

  const response = await fetch(fileUrl)
  expect(response.status).toBe(404)
  expect(response.headers.get('cache-control') || '').not.toMatch(/public|s-maxage/i)

  await superuser.collection('admins').authWithPassword(
    TEST_ADMIN.email,
    TEST_ADMIN.password,
  )
  const token = await superuser.files.getToken()
  const tokenized = await fetch(superuser.files.getURL(draft, draft.cover_image, { token }))
  expect(tokenized.status, await tokenized.clone().text()).toBe(200)
  expect(tokenized.headers.get('cache-control')).toBe('private, no-store')

  const root = await authenticateTestSuperuser()
  await root.collection('posts').update(draft.id, {
    published: true,
    published_at: new Date().toISOString(),
  })
  root.authStore.clear()

  const published = await fetch(fileUrl)
  expect(published.status).toBe(200)
  expect(published.headers.get('cache-control')).toBe(
    'public, max-age=2592000, stale-while-revalidate=86400',
  )
})
