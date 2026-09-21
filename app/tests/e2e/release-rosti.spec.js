import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { authenticateTestAdmin, loginAsTestAdmin, resetPocketBaseFixture } from './support/pocketbase-fixture.mjs'
import { TEST_POST } from './support/test-data.mjs'

test.beforeEach(async () => { await resetPocketBaseFixture() })

test('veřejné stránky ani sdílené menu neobsahují dekorativní spodní pás', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const route of ['/', '/blog', '/blog?label=cesty', `/blog/${TEST_POST.slug}`, '/gallery', '/o-mne', '/kontakt', '/neexistujici-stranka']) {
    await page.goto(route)
    await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).toBeVisible()
    await expect(page.locator('.bottom-panel')).toHaveCount(0)
    if (route !== '/') await expect(page.getByRole('complementary', { name: 'Postranní panel Moniké' })).toHaveCSS('background-image', 'none')
    if (route === '/gallery') await page.screenshot({ path: testInfo.outputPath('gallery-sidebar.png'), fullPage: true })
  }
})

test('přejmenování labelu živě změní menu, filtr, chips, detail, landing a admin výběr bez změny URL', async ({ browser, page }) => {
  const admin = await authenticateTestAdmin()
  const label = await admin.collection('blog_labels').getFirstListItem('slug = "cesty"')
  const guest = await browser.newContext()
  const pages = []
  try {
    for (const route of ['/', '/blog', '/blog?label=cesty', `/blog/${TEST_POST.slug}`]) {
      const tab = await guest.newPage()
      pages.push(tab)
      await tab.goto(route)
      if (route === '/') await tab.getByRole('button', { name: 'Blog', exact: true }).click()
      await expect(tab.locator('.public-blog-group__labels').getByRole('link', { name: label.name, exact: true })).toBeVisible()
    }
    await loginAsTestAdmin(page)
    await page.goto('/admin/blog/new')
    await page.getByLabel('Název', { exact: true }).fill('Neuložený rozepsaný článek')
    await page.getByLabel(label.name, { exact: true }).check()

    const renamed = 'Putování podle Moniké'
    await admin.collection('blog_labels').update(label.id, { name: renamed, color: '#ABCDEF' })
    for (const tab of pages) {
      const link = tab.locator('.public-blog-group__labels').getByRole('link', { name: renamed, exact: true })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', '/blog?label=cesty')
      await expect(link).not.toHaveAttribute('style')
      await expect(link).toHaveCSS('border-left-width', '0px')
      await expect(tab.getByText(label.name, { exact: true })).toHaveCount(0)
    }
    await expect(pages[0].getByTestId('category-card').nth(1)).toContainText(renamed)
    await expect(pages[0].getByTestId('category-card').nth(1)).toHaveAttribute('href', '/blog?label=cesty')
    await expect(pages[1].locator('.label-chips')).toContainText(renamed)
    await expect(pages[2].getByRole('heading', { name: renamed })).toBeVisible()
    await expect(pages[3].locator('.label-chips')).toContainText(renamed)
    await expect(page.getByLabel(renamed, { exact: true })).toBeChecked()
    await expect(page.getByLabel('Název', { exact: true })).toHaveValue('Neuložený rozepsaný článek')

    await admin.collection('blog_labels').update(label.id, { slug: 'putovani' })
    await expect(pages[2].getByRole('heading', { name: 'Tento label neexistuje.' })).toBeVisible()
    await expect(pages[0].locator('.public-blog-group__labels').getByRole('link', { name: renamed })).toHaveAttribute('href', '/blog?label=putovani')
    await pages[1].goto('/blog?label=putovani')
    await expect(pages[1].getByRole('heading', { name: TEST_POST.title })).toBeVisible()
    let postRequests = 0
    await pages[1].route('**/api/collections/posts/records**', (route) => { postRequests++; return route.continue() })
    await pages[1].goto('/blog?label=' + encodeURIComponent('" || published = false || "'))
    await expect(pages[1].getByRole('heading', { name: 'Tento label neexistuje.' })).toBeVisible()
    expect(postRequests).toBe(0)
  } finally {
    await admin.collection('blog_labels').update(label.id, { name: label.name, slug: label.slug, color: label.color })
    await guest.close()
  }
})

for (const route of ['/', '/blog', '/blog?label=cesty', `/blog/${TEST_POST.slug}`]) {
  test(`Blog accordion podporuje klávesnici, focus a zavření mobilního menu na ${route}`, async ({ page }, testInfo) => {
    const onBlog = route !== '/'
    const admin = await authenticateTestAdmin()
    const labels = await admin.collection('blog_labels').getFullList({ sort: 'sort_order,name' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(route)
    const desktop = page.getByRole('navigation', { name: 'Hlavní navigace' })
    await expect(desktop.getByRole('link')).toHaveCount(onBlog ? 5 + labels.length : 4)
    await expect(desktop.locator('.public-navigation-link')).toHaveText(['DOMŮ', 'Blog', 'GALERIE', 'O MNĚ', 'KONTAKT'])
    const gallery = desktop.getByRole('link', { name: 'GALERIE', exact: true })
    const galleryBounds = await gallery.boundingBox()
    await gallery.hover()
    await expect.poll(() => gallery.evaluate((element) => getComputedStyle(element, '::before').width)).toBe('44px')
    const needle = await gallery.evaluate((element) => {
      const line = getComputedStyle(element, '::before')
      const bounds = element.getBoundingClientRect()
      const navigation = element.closest('nav').getBoundingClientRect()
      const left = bounds.left + parseFloat(line.left)
      const right = left + parseFloat(line.width)
      return {
        gap: bounds.left - right,
        visibleWidth: Math.min(navigation.right, right) - Math.max(navigation.left, left),
        background: line.backgroundImage,
        shape: line.clipPath,
      }
    })
    expect(needle.gap).toBeCloseTo(18)
    expect(needle.visibleWidth).toBeGreaterThan(30)
    expect(needle.background).toContain('linear-gradient(90deg, rgba(0, 0, 0, 0), rgb(232, 213, 154))')
    expect(needle.shape).toBe('polygon(0px 0px, 100% 50%, 0px 100%)')
    expect(await gallery.boundingBox()).toEqual(galleryBounds)
    await page.screenshot({ path: testInfo.outputPath('desktop-hover.png'), fullPage: true })
    await page.mouse.move(400, 100)
    await expect.poll(() => gallery.evaluate((element) => getComputedStyle(element, '::before').width)).toBe('0px')
    const toggle = desktop.getByRole('button', { name: 'Blog', exact: true })
    await expect(toggle).toHaveAttribute('aria-expanded', String(onBlog))
    if (onBlog) await expect(toggle).toHaveAttribute('aria-disabled', 'true')
    await toggle.focus()
    await expect.poll(() => toggle.evaluate((element) => getComputedStyle(element, '::before').width)).toBe('44px')
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(route)
    await expect(toggle.locator('svg')).toHaveCount(0)
    await expect(desktop.getByRole('link', { name: 'Všechny články' })).toHaveAttribute('href', '/blog')
    await expect(desktop.locator('.public-blog-group__labels a')).toHaveText(['Všechny články', ...labels.map((label) => label.name)])
    expect(await desktop.evaluate((nav) => {
      const bounds = nav.getBoundingClientRect()
      return [...nav.querySelectorAll('.public-navigation-link')].every((item) => {
        const link = item.getBoundingClientRect()
        return link.top >= bounds.top && link.bottom <= bounds.bottom
      })
    })).toBe(true)
    await page.keyboard.press('Tab')
    await expect(desktop.locator('.public-blog-group__labels a').first()).toBeFocused()
    await page.keyboard.press('Escape')
    if (onBlog) {
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await expect(desktop.locator('.public-blog-group__labels a').first()).toBeFocused()
    } else {
      await expect(toggle).toBeFocused()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await page.keyboard.press('Space')
    }
    await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true })
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])

    await page.setViewportSize({ width: 360, height: 800 })
    const trigger = page.getByRole('button', { name: route === '/' ? 'Otevřít menu' : 'Otevřít hlavní menu' })
    await trigger.click()
    const drawer = page.getByRole('dialog', { name: route === '/' ? 'Mobilní navigace' : 'Hlavní menu' })
    const mobileToggle = drawer.getByRole('button', { name: 'Blog', exact: true })
    await expect(mobileToggle).toHaveAttribute('aria-expanded', String(onBlog))
    await mobileToggle.focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('Tab')
    await expect(drawer.locator('.public-blog-group__labels a').first()).toBeFocused()
    await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true })
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    await page.keyboard.press('Escape')
    if (!onBlog) {
      await expect(mobileToggle).toBeFocused()
      await expect(drawer).toBeVisible()
      await page.keyboard.press('Escape')
    }
    await expect(drawer).toBeHidden()
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(drawer.getByRole('button', { name: 'Blog', exact: true })).toHaveAttribute('aria-expanded', String(onBlog))
    if (!onBlog) await drawer.getByRole('button', { name: 'Blog', exact: true }).click()
    await drawer.getByRole('link', { name: 'Všechny články' }).click()
    await expect(drawer).toBeHidden()
    await expect(page).toHaveURL(/\/blog$/)
    await expect(page.getByRole('heading', { name: 'Blog', exact: true })).toBeVisible()
  })
}

test('owner nahraje, změní a odstraní pozadí; veřejný web použije CMS soubor a bezpečný fallback', async ({ browser, page }, testInfo) => {
  const guest = await browser.newContext()
  const publicPage = await guest.newPage()
  const admin = await authenticateTestAdmin()
  try {
    await publicPage.goto('/')
    await expect(publicPage.locator('.landing-background img')).toHaveAttribute('src', '/assets/landing/background-desktop.png')
    await loginAsTestAdmin(page)
    await page.goto('/admin/web/landing')
    for (const file of ['public/assets/landing/background-desktop.png', 'public/assets/landing/card-galerie.png']) {
      await page.getByLabel('Nahrát pozadí', { exact: true }).setInputFiles(file)
      await expect(page.getByRole('button', { name: 'Uložit pozadí' })).toBeEnabled()
      await page.getByRole('button', { name: 'Uložit pozadí' }).click()
      await expect(page.getByText('Pozadí úvodní stránky je uložené.')).toBeVisible()
      const site = await admin.collection('site_content').getFirstListItem('key = "main"')
      expect(site.background_width).toBeGreaterThan(0)
      expect(site.background_width).toBeLessThanOrEqual(4096)
      const background = publicPage.locator('.landing-background img')
      await expect(background).toHaveAttribute('src', new RegExp(site.landing_background))
      await expect.poll(() => background.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0)
      const response = await publicPage.request.get(await background.getAttribute('src'))
      expect(response.status()).toBe(200)
      await publicPage.screenshot({ path: testInfo.outputPath(`${site.id}-${site.landing_background}.png`) })
    }
    const site = await admin.collection('site_content').getFirstListItem('key = "main"')
    await expect(admin.collection('site_content').update(site.id, { background_width: 123 })).rejects.toMatchObject({ status: 404 })
    const invalid = new FormData()
    invalid.set('landing_background', new File(['<svg></svg>'], 'fake.png', { type: 'image/png' }))
    await expect(admin.collection('site_content').update(site.id, invalid)).rejects.toMatchObject({ status: 400 })
    await publicPage.route('**/api/files/**', (route) => route.abort())
    await publicPage.reload()
    await expect(publicPage.locator('.landing-background img')).toHaveAttribute('src', '/assets/landing/background-desktop.png')
    await publicPage.unroute('**/api/files/**')
    await page.getByLabel('Použít výchozí pozadí').check()
    await page.getByRole('button', { name: 'Uložit pozadí' }).click()
    await expect(page.getByText('Pozadí úvodní stránky je uložené.')).toBeVisible()
    const cleared = await admin.collection('site_content').getOne(site.id)
    expect(cleared.landing_background).toBe('')
    expect(cleared.background_width).toBe(0)
    await expect(publicPage.locator('.landing-background img')).toHaveAttribute('src', '/assets/landing/background-desktop.png')
  } finally { await guest.close() }
})

test('produkční HTTP runtime zachová SEO, API, skutečné 404 a bezpečnostní hlavičky', async ({ request }) => {
  test.skip(process.env.MONIKE_E2E_PRODUCTION !== 'true', 'Vyžaduje build a MONIKE_E2E_PRODUCTION=true.')
  const article = await request.get(`/blog/${TEST_POST.slug}`)
  expect(article.status()).toBe(200)
  expect(article.headers()['content-security-policy']).toContain("script-src 'self'")
  expect(await article.text()).toContain('property="og:type" content="article"')
  expect((await request.get('/blog/neexistujici-clanek')).status()).toBe(404)
  expect((await request.get('/nezname')).status()).toBe(404)
  expect((await request.get('/api/health/ready')).status()).toBe(200)
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /')
})
