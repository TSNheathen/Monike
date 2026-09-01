import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { loginAsTestAdmin, resetPocketBaseFixture } from './support/pocketbase-fixture.mjs'
import { TEST_POST } from './support/test-data.mjs'

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await resetPocketBaseFixture()
})

async function expectNoPageOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    document: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    body: document.body.scrollWidth <= document.body.clientWidth,
  }))).toEqual({ document: true, body: true })
}

test('veřejné a admin drawer menu drží focus, zavře se Escape a vrátí focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const publicTrigger = page.getByRole('button', { name: 'Otevřít menu' })
  await publicTrigger.click()
  const publicDrawer = page.getByRole('dialog', { name: 'Mobilní navigace' })
  await expect(publicDrawer).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zavřít menu' })).toBeFocused()
  expect(await page.locator('#root').evaluate((element) => element.inert)).toBe(true)
  await page.keyboard.press('Shift+Tab')
  expect(await publicDrawer.evaluate((drawer) => drawer.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(publicDrawer).toHaveCount(0)
  await expect(publicTrigger).toBeFocused()

  await loginAsTestAdmin(page)
  const adminTrigger = page.getByRole('button', { name: 'Otevřít menu administrace' })
  await adminTrigger.click()
  const adminDrawer = page.getByRole('dialog', { name: 'Menu administrace' })
  await expect(adminDrawer).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zavřít menu administrace' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(adminTrigger).toBeFocused()
})

test('SPA změna trasy přesune focus na nový nadpis, retry jej nepřesouvá', async ({ page }) => {
  await page.goto('/blog')
  await page.getByRole('link', { name: 'Kontakt' }).click()
  await expect(page.getByRole('heading', { name: 'Kontakt', level: 1 })).toBeFocused()

  await page.route('**/api/collections/posts/records**', (route) => route.abort('connectionfailed'))
  await page.goto('/blog')
  const retry = page.getByRole('button', { name: 'Zkusit znovu' })
  await retry.focus()
  await retry.click()
  await expect(retry).toBeFocused()
})

test('dialog začíná bezpečnou akcí, trapuje focus a vrací jej spouštěči', async ({ page }) => {
  await loginAsTestAdmin(page)
  await page.goto('/admin/blog/new')
  await page.getByLabel('Název').fill('Rozepsaný článek')
  const blogLink = page.getByRole('link', { name: 'Blog', exact: true })
  await blogLink.click()
  const dialog = page.getByRole('dialog', { name: 'Neuložené změny' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zůstat' })).toBeFocused()
  expect(await page.locator('#root').evaluate((element) => element.inert)).toBe(true)
  await page.keyboard.press('Shift+Tab')
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(blogLink).toBeFocused()
})

test('toolbar podporuje šipky a image dialog má popsaná pole a stav', async ({ page }) => {
  await loginAsTestAdmin(page)
  await page.goto('/admin/web/o-mne')
  const paragraph = page.getByRole('button', { name: 'Odstavec' })
  await paragraph.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button', { name: 'Nadpis 2' })).toBeFocused()
  await page.getByRole('button', { name: 'Vložit obrázek' }).click()
  const dialog = page.getByRole('dialog', { name: 'Vložit obrázek' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Alternativní text')).toBeFocused()
  await expect(dialog.getByLabel('Šířka v procentech')).toHaveAttribute('min', '20')
  await expect(dialog.getByLabel('Šířka v procentech')).toHaveAttribute('max', '100')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Vložit obrázek' })).toBeFocused()
})

test('GLightbox má český modal, alt, focus trap a přesný focus return', async ({ page }) => {
  await page.goto('/gallery')
  const opener = page.getByRole('link', { name: 'Otevřít obrázek: Testovací obrázek' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Prohlížeč galerie Moniké' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zavřít galerii' })).toBeFocused()
  await expect(dialog.getByAltText('Jednobarevný testovací bod')).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
})

test('reflow a 200% text zachovají obsah bez page-level overflow', async ({ page }) => {
  const viewports = [
    { width: 320, height: 800 },
    { width: 360, height: 800 },
    { width: 759, height: 900 },
    { width: 760, height: 900 },
    { width: 1099, height: 900 },
    { width: 1100, height: 800 },
  ]
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const route of ['/', '/blog', `/blog/${TEST_POST.slug}`, '/gallery', '/o-mne', '/kontakt']) {
      await page.goto(route)
      await expectNoPageOverflow(page)
    }
  }

  await page.setViewportSize({ width: 760, height: 900 })
  await page.goto('/kontakt')
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  await expectNoPageOverflow(page)
  await expect(page.getByRole('link', { name: 'monike@example.com' })).toBeVisible()
})

test('axe A/AA nemá porušení na reprezentativních public/admin trasách ani modalu', async ({ page }) => {
  const publicRoutes = ['/', '/blog', `/blog/${TEST_POST.slug}`, '/gallery', '/o-mne', '/kontakt', '/neznamy-web']
  for (const route of publicRoutes) {
    await page.goto(route)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations, `axe violations on ${route}`).toEqual([])
  }

  await loginAsTestAdmin(page)
  for (const route of ['/admin/blog', '/admin/blog/new', '/admin/gallery', '/admin/gallery/new', '/admin/web/landing', '/admin/web/o-mne', '/admin/web/kontakt']) {
    await page.goto(route)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations, `axe violations on ${route}`).toEqual([])
  }

  await page.goto('/admin/blog/new')
  await page.getByLabel('Název').fill('Neuložený obsah')
  await page.getByRole('link', { name: 'Galerie', exact: true }).click()
  const modalResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(modalResults.violations).toEqual([])
})
