import { expect, test } from '@playwright/test'
import { loginAsTestAdmin, resetPocketBaseFixture } from './support/pocketbase-fixture.mjs'

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await resetPocketBaseFixture()
})

test('veřejný shell má skip link, jeden main a bez vodorovného přetečení na 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/blog')

  await expect(page.getByRole('link', { name: 'Přeskočit na hlavní obsah' })).toHaveAttribute('href', '#main-content')
  await expect(page.locator('main')).toHaveCount(1)
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflows).toBe(false)
})

test('owner token zůstává v sessionStorage a nikdy v localStorage ani cookies', async ({ page }) => {
  await loginAsTestAdmin(page)
  const storage = await page.evaluate(() => ({
    session: sessionStorage.getItem('monike_owner_session_v1'),
    local: Object.keys(localStorage).filter((key) => key.includes('auth') || key.includes('monike')),
    cookie: document.cookie,
  }))

  expect(storage.session).toBeTruthy()
  expect(storage.local).toEqual([])
  expect(storage.cookie).not.toContain('pb_auth')
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace administrace' })).toBeVisible()
})
