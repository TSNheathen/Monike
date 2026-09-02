import { expect, test } from '@playwright/test'
import {
  authenticateTestAdmin,
  authenticateTestSuperuser,
  resetPocketBaseFixture,
} from './support/pocketbase-fixture.mjs'
import { TEST_POCKETBASE_URL, TEST_POST } from './support/test-data.mjs'

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

const paragraph = (value) => ({
  type: 'doc',
  content: [
    value
      ? { type: 'paragraph', content: [{ type: 'text', text: value }] }
      : { type: 'paragraph' },
  ],
})

async function call(token, path, { method = 'POST', body, headers } = {}) {
  const response = await fetch(`${TEST_POCKETBASE_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: token } : {}),
      ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try {
    data = await response.json()
  } catch {
    // Some successful PocketBase operations have no response body.
  }
  return { response, data }
}

async function stageAsset(token, parentType, parentId, overrides = {}) {
  const form = new FormData()
  form.set('parentType', parentType)
  form.set('parentId', parentId)
  form.set(
    'image',
    new File([overrides.bytes || onePixelPng], overrides.name || 'bod.png', {
      type: overrides.type || 'image/png',
    }),
  )
  return call(token, '/api/monike/content-assets/stage', { body: form })
}

async function labelIds(client) {
  const labels = await client.collection('blog_labels').getFullList()
  return Object.fromEntries(labels.map((label) => [label.slug, label.id]))
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await resetPocketBaseFixture()
})

test('vynucuje admins identitu a serverové vlastnictví assetů', async () => {
  const superuser = await authenticateTestSuperuser()
  const admin = await authenticateTestAdmin()
  const post = await superuser
    .collection('posts')
    .getFirstListItem(superuser.filter('slug = {:slug}', { slug: TEST_POST.slug }))
  const payload = {
    id: post.id,
    expectedUpdated: post.updated,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    labels: post.labels,
    content_json: paragraph('Obsah'),
    published: true,
  }

  expect((await call('', '/api/monike/posts/save', { body: payload })).response.status).toBe(401)
  expect(
    (await call(superuser.authStore.token, '/api/monike/posts/save', { body: payload })).response
      .status,
  ).toBe(403)

  const staged = await stageAsset(admin.authStore.token, 'post', post.id)
  expect(staged.response.status).toBe(201)
  expect(staged.data.record).toMatchObject({ active: false, width: 1, height: 1 })

  await expect(
    admin.collection('content_assets').update(staged.data.record.id, { active: true }),
  ).rejects.toMatchObject({ status: 403 })
  await expect(
    admin.collection('post_slug_aliases').create({ slug: 'rucni-alias', post: post.id }),
  ).rejects.toMatchObject({ status: 403 })
  await expect(
    admin.collection('posts').update(post.id, {
      content_html: '<script>obejití serializeru</script>',
      published_at: '2099-01-01 00:00:00.000Z',
    }),
  ).rejects.toMatchObject({ status: 404 })
  await expect(
    admin.collection('posts').create({
      title: 'Obejití transakce',
      slug: 'obejiti-transakce',
      labels: post.labels,
    }),
  ).rejects.toMatchObject({ status: 403 })
  await expect(
    superuser.collection('content_assets').create({
      image: new File([onePixelPng], 'bez-vlastnika.png', { type: 'image/png' }),
      active: false,
      width: 1,
      height: 1,
    }),
  ).rejects.toMatchObject({ status: 400 })

  const cover = await admin.collection('posts').update(post.id, {
    cover_image: new File([onePixelPng], 'cover.png', { type: 'image/png' }),
  })
  expect(cover).toMatchObject({ cover_width: 1, cover_height: 1 })

  const stored = await superuser.collection('content_assets').getOne(staged.data.record.id)
  const guestFile = await fetch(superuser.files.getURL(stored, stored.image))
  expect(guestFile.status).toBe(404)
})

test('přijme dekódovatelný raster a odmítne podvržený či poškozený upload', async ({ page }) => {
  const admin = await authenticateTestAdmin()
  const superuser = await authenticateTestSuperuser()
  const post = await superuser
    .collection('posts')
    .getFirstListItem(superuser.filter('slug = {:slug}', { slug: TEST_POST.slug }))
  const before = await superuser.collection('content_assets').getFullList()

  const browserRasters = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 3
    const context = canvas.getContext('2d')
    context.fillStyle = '#b9975b'
    context.fillRect(0, 0, 2, 3)
    return Object.fromEntries(
      ['image/jpeg', 'image/png', 'image/webp'].map((mime) => [
        mime,
        canvas.toDataURL(mime, 0.9).split(',')[1],
      ]),
    )
  })
  for (const [type, extension] of [
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ]) {
    const valid = await stageAsset(admin.authStore.token, 'post', post.id, {
      name: `platny.${extension}`,
      type,
      bytes: Buffer.from(browserRasters[type], 'base64'),
    })
    expect(valid.response.status).toBe(201)
    expect(valid.data.record).toMatchObject({ width: 2, height: 3, active: false })
  }

  for (const invalid of [
    { name: 'skript.png', type: 'image/png', bytes: Buffer.from('<svg><script/></svg>') },
    { name: 'prejmenovany.jpg', type: 'image/jpeg', bytes: onePixelPng },
    { name: 'spatny.png', type: 'image/jpeg', bytes: onePixelPng },
    { name: 'poskozeny.png', type: 'image/png', bytes: onePixelPng.subarray(0, 24) },
  ]) {
    const result = await stageAsset(admin.authStore.token, 'post', post.id, invalid)
    expect(result.response.status).toBe(400)
    expect(result.data.data.image.code).toBeTruthy()
  }

  const after = await superuser.collection('content_assets').getFullList()
  expect(after).toHaveLength(before.length + 3)

  const invalidGallery = new FormData()
  invalidGallery.set('title', 'Bez alternativního textu')
  invalidGallery.set('alt_text', '')
  invalidGallery.set('published', 'true')
  invalidGallery.set('image', new File([onePixelPng], 'galerie.png', { type: 'image/png' }))
  await expect(admin.collection('gallery_images').create(invalidGallery)).rejects.toMatchObject({
    status: 400,
  })
})

test('uloží celý článek atomicky, spravuje historii slugů a resolver', async () => {
  const admin = await authenticateTestAdmin()
  const superuser = await authenticateTestSuperuser()
  let post = await superuser
    .collection('posts')
    .getFirstListItem(superuser.filter('slug = {:slug}', { slug: TEST_POST.slug }))
  const originalSlug = post.slug
  const labelBySlug = await labelIds(superuser)

  const secondResult = await call(admin.authStore.token, '/api/monike/posts/save', {
    body: {
      title: 'Druhý koncept',
      slug: 'druhy-koncept',
      excerpt: '',
      labels: [labelBySlug.vzpominky],
      content_json: paragraph(''),
      published: false,
    },
  })
  expect(secondResult.response.status).toBe(200)
  const secondId = secondResult.data.record.id

  const firstAsset = await stageAsset(admin.authStore.token, 'post', post.id)
  const foreignAsset = await stageAsset(admin.authStore.token, 'post', secondId)
  expect(firstAsset.response.status).toBe(201)
  expect(foreignAsset.response.status).toBe(201)

  const changedSlug = 'zmeneny-testovaci-clanek'
  const content = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: '<bezpečný text>' }] },
      {
        type: 'monikeImage',
        attrs: {
          assetId: firstAsset.data.record.id,
          alt: 'Testovací obrázek',
          widthPercent: 75,
          align: 'center',
          wrap: 'none',
        },
      },
    ],
  }
  const saved = await call(admin.authStore.token, '/api/monike/posts/save', {
    body: {
      id: post.id,
      expectedUpdated: post.updated,
      title: post.title,
      slug: changedSlug,
      excerpt: post.excerpt,
      labels: [labelBySlug.cesty, labelBySlug['proces-tvorby']],
      content_json: content,
      content_html: '<script>nedůvěryhodné</script>',
      published: true,
      published_at: '2099-01-01T00:00:00Z',
    },
  })
  expect(saved.response.status).toBe(200)
  expect(saved.data.record.content_html).toContain('&lt;bezpečný text&gt;')
  expect(saved.data.record.content_html).not.toContain('<script')
  expect(saved.data.record.published_at).toBe(post.published_at)
  expect(saved.data.record.labels).toEqual([labelBySlug.cesty, labelBySlug['proces-tvorby']])
  expect((await superuser.collection('content_assets').getOne(firstAsset.data.record.id)).active).toBe(true)

  let aliases = await superuser.collection('post_slug_aliases').getFullList()
  expect(aliases.map((alias) => alias.slug)).toContain(originalSlug)
  let resolved = await call('', `/api/monike/articles/${changedSlug}`, { method: 'GET' })
  expect(resolved.response.status).toBe(200)
  expect(resolved.data.kind).toBe('canonical')
  expect(resolved.data.record.expand.labels.map((label) => label.slug)).toEqual([
    'cesty',
    'proces-tvorby',
  ])
  resolved = await call('', `/api/monike/articles/${originalSlug}`, { method: 'GET' })
  expect(resolved.data).toEqual({ kind: 'alias', location: `/blog/${changedSlug}` })
  expect((await call('', '/api/monike/articles/neexistuje', { method: 'GET' })).response.status).toBe(404)
  expect(
    (await call('', '/api/monike/articles/x%27%20%7C%7C%20published%20%3D%20true', { method: 'GET' }))
      .response.status,
  ).toBe(404)

  post = await superuser.collection('posts').getOne(post.id)
  const forcedSave = await call(admin.authStore.token, '/api/monike/posts/save', {
    headers: { 'X-Monike-Test-Failure': 'post-after-parent-save' },
    body: {
      id: post.id,
      expectedUpdated: post.updated,
      title: 'Tento název se musí vrátit zpět',
      slug: 'docasny-slug-k-rollbacku',
      excerpt: post.excerpt,
      labels: post.labels,
      content_json: content,
      published: true,
    },
  })
  expect(forcedSave.response.status).toBe(500)
  const afterForcedSave = await superuser.collection('posts').getOne(post.id)
  expect(afterForcedSave).toMatchObject({ title: post.title, slug: changedSlug })
  expect(
    (await superuser.collection('post_slug_aliases').getFullList()).map((alias) => alias.slug),
  ).toContain(originalSlug)

  post = afterForcedSave
  const firstPublishedAt = post.published_at
  const hidden = await call(admin.authStore.token, '/api/monike/posts/save', {
    body: {
      id: post.id,
      expectedUpdated: post.updated,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      labels: post.labels,
      content_json: content,
      published: false,
    },
  })
  expect(hidden.response.status).toBe(200)
  expect(hidden.data.record.published_at).toBe(firstPublishedAt)
  expect(
    (await call('', `/api/monike/articles/${changedSlug}`, { method: 'GET' })).response.status,
  ).toBe(404)
  expect(
    (await call('', `/api/monike/articles/${originalSlug}`, { method: 'GET' })).response.status,
  ).toBe(404)

  post = await superuser.collection('posts').getOne(post.id)
  const republished = await call(admin.authStore.token, '/api/monike/posts/save', {
    body: {
      id: post.id,
      expectedUpdated: post.updated,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      labels: post.labels,
      content_json: content,
      published: true,
    },
  })
  expect(republished.response.status).toBe(200)
  expect(republished.data.record.published_at).toBe(firstPublishedAt)
  post = await superuser.collection('posts').getOne(post.id)

  const crossParent = await call(admin.authStore.token, '/api/monike/posts/save', {
    body: {
      id: post.id,
      expectedUpdated: post.updated,
      title: 'Tento název se nesmí uložit',
      slug: post.slug,
      excerpt: post.excerpt,
      labels: post.labels,
      content_json: {
        type: 'doc',
        content: [
          {
            type: 'monikeImage',
            attrs: {
              assetId: foreignAsset.data.record.id,
              alt: 'Cizí obrázek',
              widthPercent: 100,
              align: 'center',
              wrap: 'none',
            },
          },
        ],
      },
      published: true,
    },
  })
  expect(crossParent.response.status).toBe(400)
  expect((await superuser.collection('posts').getOne(post.id)).title).toBe(post.title)

  const collision = await call(admin.authStore.token, '/api/monike/posts/save', {
    body: {
      id: post.id,
      expectedUpdated: post.updated,
      title: post.title,
      slug: 'druhy-koncept',
      excerpt: post.excerpt,
      labels: post.labels,
      content_json: content,
      published: true,
    },
  })
  expect(collision.response.status).toBe(400)
  expect((await superuser.collection('posts').getOne(post.id)).slug).toBe(changedSlug)

  const reclaimed = await call(admin.authStore.token, '/api/monike/posts/save', {
    body: {
      id: post.id,
      expectedUpdated: post.updated,
      title: post.title,
      slug: originalSlug,
      excerpt: post.excerpt,
      labels: post.labels,
      content_json: content,
      published: true,
    },
  })
  expect(reclaimed.response.status).toBe(200)
  aliases = await superuser.collection('post_slug_aliases').getFullList()
  expect(aliases.map((alias) => alias.slug)).toContain(changedSlug)
  expect(aliases.map((alias) => alias.slug)).not.toContain(originalSlug)

  const stale = await call(admin.authStore.token, '/api/monike/posts/save', {
    body: {
      id: post.id,
      expectedUpdated: post.updated,
      title: 'Zastaralý zápis',
      slug: originalSlug,
      excerpt: post.excerpt,
      labels: post.labels,
      content_json: content,
      published: true,
    },
  })
  expect(stale.response.status).toBe(409)

  const current = await superuser.collection('posts').getOne(post.id)
  const forcedDelete = await call(
    admin.authStore.token,
    `/api/monike/posts/${post.id}/delete`,
    {
      headers: { 'X-Monike-Test-Failure': 'post-delete-after-dependents' },
      body: { expectedUpdated: current.updated },
    },
  )
  expect(forcedDelete.response.status).toBe(500)
  expect((await superuser.collection('posts').getOne(post.id)).id).toBe(post.id)
  expect((await superuser.collection('content_assets').getOne(firstAsset.data.record.id)).id).toBe(
    firstAsset.data.record.id,
  )

  const deleted = await call(
    admin.authStore.token,
    `/api/monike/posts/${post.id}/delete`,
    { body: { expectedUpdated: current.updated } },
  )
  expect(deleted.response.status).toBe(200)
  await expect(superuser.collection('posts').getOne(post.id)).rejects.toMatchObject({ status: 404 })
  await expect(
    superuser.collection('content_assets').getOne(firstAsset.data.record.id),
  ).rejects.toMatchObject({ status: 404 })
  expect(
    (await call('', `/api/monike/articles/${originalSlug}`, { method: 'GET' })).response.status,
  ).toBe(404)
})

test('vynucuje unique slug a blokuje smazání použitého labelu', async () => {
  const admin = await authenticateTestAdmin()
  const superuser = await authenticateTestSuperuser()
  const created = await admin.collection('blog_labels').create({
    name: 'Dočasný label',
    slug: 'docasny-label',
    color: '#123ABC',
    sort_order: 90,
  })
  expect(created).toMatchObject({ color: '#123ABC', sort_order: 90 })

  await expect(admin.collection('blog_labels').create({
    name: 'Duplicitní slug',
    slug: 'docasny-label',
    color: '#654321',
    sort_order: 91,
  })).rejects.toMatchObject({ status: 400 })

  const cesty = await superuser.collection('blog_labels').getFirstListItem('slug = "cesty"')
  const blocked = await call(admin.authStore.token, `/api/monike/labels/${cesty.id}/delete`, {
    body: {},
  })
  expect(blocked.response.status).toBe(409)
  expect(blocked.data.message).toMatch(/Label je stále používaný/)
  await expect(admin.collection('blog_labels').delete(cesty.id)).rejects.toMatchObject({
    status: 409,
  })

  const deleted = await call(admin.authStore.token, `/api/monike/labels/${created.id}/delete`, {
    body: {},
  })
  expect(deleted.response.status).toBe(200)
  await expect(superuser.collection('blog_labels').getOne(created.id)).rejects.toMatchObject({
    status: 404,
  })
})

test('uloží About assety a pořadí galerie bez částečného commitu', async () => {
  const admin = await authenticateTestAdmin()
  const superuser = await authenticateTestSuperuser()
  const about = await superuser.collection('about_page').getFirstListItem('key = "main"')
  const staged = await stageAsset(admin.authStore.token, 'about', about.id)
  expect(staged.response.status).toBe(201)
  const document = {
    type: 'doc',
    content: [
      {
        type: 'monikeImage',
        attrs: {
          assetId: staged.data.record.id,
          alt: 'Příběhový obraz',
          widthPercent: 50,
          align: 'right',
          wrap: 'none',
        },
      },
    ],
  }
  const saved = await call(admin.authStore.token, '/api/monike/about/save', {
    body: { expectedUpdated: about.updated, content_json: document },
  })
  expect(saved.response.status).toBe(200)
  expect((await superuser.collection('content_assets').getOne(staged.data.record.id)).active).toBe(true)

  const savedAbout = await superuser.collection('about_page').getOne(about.id)
  const forcedAbout = await call(admin.authStore.token, '/api/monike/about/save', {
    headers: { 'X-Monike-Test-Failure': 'about-after-parent-save' },
    body: {
      expectedUpdated: savedAbout.updated,
      content_json: paragraph('Tato změna se musí vrátit zpět.'),
    },
  })
  expect(forcedAbout.response.status).toBe(500)
  expect((await superuser.collection('about_page').getOne(about.id)).content_html).toBe(
    savedAbout.content_html,
  )
  expect((await superuser.collection('content_assets').getOne(staged.data.record.id)).active).toBe(true)

  const imageData = new FormData()
  imageData.set('title', 'Druhý obrázek')
  imageData.set('alt_text', 'Druhý testovací bod')
  imageData.set('caption', '')
  imageData.set('sort_order', '2')
  imageData.set('published', 'true')
  imageData.set('image', new File([onePixelPng], 'druhy.png', { type: 'image/png' }))
  await superuser.collection('gallery_images').create(imageData)
  let gallery = await superuser.collection('gallery_images').getFullList({ sort: 'sort_order' })
  const reversed = gallery.map((item) => item.id).reverse()
  const reordered = await call(admin.authStore.token, '/api/monike/gallery/reorder', {
    body: { ids: reversed },
  })
  expect(reordered.response.status).toBe(200)
  gallery = await superuser.collection('gallery_images').getFullList({ sort: 'sort_order' })
  expect(gallery.map((item) => item.id)).toEqual(reversed)

  const forcedOrder = await call(admin.authStore.token, '/api/monike/gallery/reorder', {
    headers: { 'X-Monike-Test-Failure': 'gallery-after-first-save' },
    body: { ids: reversed.slice().reverse() },
  })
  expect(forcedOrder.response.status).toBe(500)
  gallery = await superuser.collection('gallery_images').getFullList({ sort: 'sort_order' })
  expect(gallery.map((item) => item.id)).toEqual(reversed)

  const beforeFailure = gallery.map((item) => ({ id: item.id, order: item.sort_order }))
  const failed = await call(admin.authStore.token, '/api/monike/gallery/reorder', {
    body: { ids: [gallery[1].id, 'xxxxxxxxxxxxxxx'] },
  })
  expect(failed.response.status).toBe(400)
  gallery = await superuser.collection('gallery_images').getFullList({ sort: 'sort_order' })
  expect(gallery.map((item) => ({ id: item.id, order: item.sort_order }))).toEqual(beforeFailure)
})
