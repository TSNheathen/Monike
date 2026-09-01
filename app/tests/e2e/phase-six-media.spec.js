import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  authenticateTestSuperuser,
  resetPocketBaseFixture,
} from './support/pocketbase-fixture.mjs'
import { TEST_POST } from './support/test-data.mjs'

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

test.beforeAll(async () => {
  await resetPocketBaseFixture()
  const client = await authenticateTestSuperuser()
  const image = await readFile(new URL('../../public/assets/landing/bottom-panel.png', import.meta.url))
  const upload = (name) => new File([image], name, { type: 'image/png' })

  const post = await client.collection('posts').getFirstListItem(
    client.filter('slug = {:slug}', { slug: TEST_POST.slug }),
  )
  await client.collection('posts').update(post.id, { cover_image: upload('cover.png') })

  const gallery = await client.collection('gallery_images').getFirstListItem('published = true')
  await client.collection('gallery_images').update(gallery.id, { image: upload('gallery.png') })

  const about = await client.collection('about_page').getFirstListItem('key = "main"')
  await client.collection('about_page').update(about.id, { portrait: upload('portrait.png') })
  client.authStore.clear()
})

function fileRequests(page) {
  const urls = []
  page.on('request', (request) => {
    if (request.resourceType() === 'image' && request.url().includes('/api/files/')) {
      urls.push(request.url())
    }
  })
  return urls
}

test('grid a blog list stahují jen malé varianty a lightbox až po otevření', async ({ page }) => {
  const requests = fileRequests(page)

  await page.goto('/gallery')
  const galleryImage = page.locator('.gallery-grid img').first()
  await expect(galleryImage).toHaveAttribute('srcset', /thumb=480x600.*thumb=800x1000/)
  await expect.poll(() => galleryImage.evaluate((image) => image.currentSrc)).toContain('thumb=800x1000')
  expect(requests.some((url) => /thumb=(1200x0|1600x0|2400x0)/.test(url))).toBe(false)
  expect(requests.some((url) => url.includes('gallery_') && !url.includes('thumb='))).toBe(false)

  await page.getByRole('link', { name: 'Otevřít obrázek: Testovací obrázek' }).click()
  await expect.poll(() => requests.some((url) => /thumb=(1200x0|1600x0)/.test(url))).toBe(true)
  await page.keyboard.press('Escape')

  requests.length = 0
  await page.goto('/blog')
  const listCover = page.locator('.post-card__cover').first()
  await expect(listCover).toHaveAttribute('srcset', /thumb=480x0.*thumb=800x0/)
  expect(await listCover.getAttribute('srcset')).not.toMatch(/thumb=(1200x0|1600x0|2400x0)/)
  await expect.poll(() => listCover.evaluate((image) => image.currentSrc)).toContain('thumb=800x0')
  expect(requests.some((url) => /thumb=(1200x0|1600x0|2400x0)/.test(url))).toBe(false)
})

test('article cover a About používají správnou prioritu, rozměry a horní limity', async ({ page }) => {
  await page.goto(`/blog/${TEST_POST.slug}`)
  const cover = page.locator('.article-cover')
  await expect(cover).toHaveAttribute('loading', 'eager')
  await expect(cover).toHaveAttribute('fetchpriority', 'high')
  await expect(cover).toHaveAttribute('width', '1774')
  await expect(cover).toHaveAttribute('height', '887')
  await expect.poll(() => cover.evaluate((image) => image.currentSrc)).toContain('thumb=800x0')
  expect(await cover.getAttribute('srcset')).not.toContain('thumb=2400x0')

  await page.goto('/o-mne')
  const portrait = page.locator('.about-portrait img')
  await expect(portrait).toHaveAttribute('loading', 'eager')
  await expect(portrait).toHaveAttribute('width', '1774')
  await expect(portrait).toHaveAttribute('height', '887')
  expect(await portrait.getAttribute('srcset')).toContain('thumb=1600x0')
  expect(await portrait.getAttribute('srcset')).not.toContain('thumb=2400x0')
})

test('rezervované rozměry médií drží layout shift pod 0,1', async ({ page }) => {
  await page.addInitScript(() => {
    window.__monikeLayoutShift = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__monikeLayoutShift += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })

  for (const route of ['/gallery', `/blog/${TEST_POST.slug}`, '/o-mne']) {
    await page.goto(route)
    await page.locator('main img').first().waitFor({ state: 'visible' })
    await page.waitForTimeout(100)
    const cls = await page.evaluate(() => window.__monikeLayoutShift)
    expect(cls, `CLS na ${route}`).toBeLessThanOrEqual(0.1)
  }
})
