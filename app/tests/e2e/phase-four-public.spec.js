import { expect, test } from '@playwright/test'
import { resetPocketBaseFixture } from './support/pocketbase-fixture.mjs'
import { TEST_POST } from './support/test-data.mjs'

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await resetPocketBaseFixture()
})

test('CMS-backed landing, blog, článek, galerie, O mně a Kontakt mají ready stav', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Tvořím. Cestuji. Žiju.')).toBeVisible()
  await expect(page.getByTestId('category-card')).toHaveCount(5)
  const cardSrcset = await page.getByTestId('category-card').first().locator('img').getAttribute('srcset')
  expect(cardSrcset).toContain('thumb=480x0')
  expect(cardSrcset).toContain('thumb=800x0')
  await expect(page.getByTestId('category-card').nth(1)).toHaveAttribute('href', '/blog?label=cesty')

  await page.goto('/blog')
  await expect(page.getByRole('heading', { name: TEST_POST.title })).toBeVisible()

  await page.goto('/blog?label=cesty')
  await expect(page.getByRole('heading', { name: 'Cesty & příběhy' })).toBeVisible()
  await expect(page.getByRole('heading', { name: TEST_POST.title })).toBeVisible()
  await expect(page.locator('.label-chips a').filter({ hasText: 'Cesty & příběhy' })).toHaveAttribute(
    'style',
    /--label-color: #B88A36/i,
  )

  await page.goto(`/blog/${TEST_POST.slug}`)
  await expect(page.getByText('Testovací obsah z lokálního PocketBase.')).toBeVisible()
  await expect(page).toHaveTitle(`${TEST_POST.title} | Moniké`)

  await page.goto('/gallery')
  await expect(page.getByRole('link', { name: 'Otevřít obrázek: Testovací obrázek' })).toBeVisible()

  await page.goto('/o-mne')
  await expect(page.getByAltText('Testovací portrét autorky Moniké')).toBeVisible()

  await page.goto('/kontakt')
  await expect(page.getByRole('link', { name: 'monike@example.com' })).toHaveAttribute('href', 'mailto:monike@example.com')
  await expect(page.getByRole('link', { name: 'Instagram' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Facebook' })).toBeVisible()
})

test('úspěšný prázdný blog nikdy nezobrazí fixture ani retry', async ({ page }) => {
  await page.route('**/api/collections/posts/records**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ page: 1, perPage: 500, totalItems: 0, totalPages: 0, items: [] }),
  }))
  await page.goto('/blog')
  await expect(page.getByText('Zatím tu nejsou žádné publikované články.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zkusit znovu' })).toHaveCount(0)
  await expect(page.getByText('První zápisky z cest')).toHaveCount(0)
})

test('nedostupný blog není empty a nabízí explicitní retry', async ({ page }) => {
  await page.route('**/api/collections/posts/records**', (route) => route.abort('connectionfailed'))
  await page.goto('/blog')
  await expect(page.getByRole('button', { name: 'Zkusit znovu' })).toBeVisible()
  await expect(page.getByText('Zatím tu nejsou žádné publikované články.')).toHaveCount(0)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
})

test('neplatný label nevolá seznam článků, zůstává 200 a noindex', async ({ page }) => {
  let postRequests = 0
  await page.route('**/api/collections/posts/records**', async (route) => {
    postRequests += 1
    await route.continue()
  })
  const response = await page.goto('/blog?label=cesty&label=vzpominky')
  expect(response.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Tento label neexistuje.' })).toBeVisible()
  expect(postRequests).toBe(0)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'http://127.0.0.1:4173/blog')

  await page.goto('/blog?label=neznamy-label')
  await expect(page.getByRole('heading', { name: 'Tento label neexistuje.' })).toBeVisible()
  expect(postRequests).toBe(0)
})

test('potvrzeně chybějící článek není fixture ani unavailable', async ({ page }) => {
  await page.route('**/api/monike/articles/chybi', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ status: 404, message: 'Not found.' }),
  }))
  await page.goto('/blog/chybi')
  await expect(page.getByText('Článek nebyl nalezen.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zkusit znovu' })).toHaveCount(0)
  await expect(page.getByText('Testovací obsah z lokálního PocketBase.')).toHaveCount(0)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
})

test('chybějící povinný singleton je configuration error s retry', async ({ page }) => {
  await page.route('**/api/collections/site_content/records**', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ status: 404, message: 'Not found.' }),
  }))
  await page.goto('/kontakt')
  await expect(page.getByText('Obsah webu není správně nastavený.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zkusit znovu' })).toBeVisible()
  await expect(page.getByText('monike@example.com')).toHaveCount(0)
})

test('selhání landing CMS oblasti nezobrazí starou kopii ani karty', async ({ page }) => {
  await page.route('**/api/collections/site_content/records**', (route) => route.abort('connectionfailed'))
  await page.goto('/')
  await expect(page.getByText('Obsah úvodní stránky se teď nepodařilo načíst.')).toBeVisible()
  await expect(page.getByText('Tvořím. Cestuji. Žiju.')).toHaveCount(0)
  await expect(page.getByTestId('category-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Zkusit znovu' })).toBeVisible()
})

test('všechny ready veřejné trasy nemají page-level horizontal scroll při 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  for (const path of ['/', '/blog', `/blog/${TEST_POST.slug}`, '/gallery', '/o-mne', '/kontakt']) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow, `Vodorovné přetečení na ${path}`).toBe(false)
  }
})
