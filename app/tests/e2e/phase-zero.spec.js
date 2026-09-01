import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  authenticateTestAdmin,
  loginAsTestAdmin,
  resetPocketBaseFixture,
} from './support/pocketbase-fixture.mjs'
import { expectHttpResponse } from './support/http-assertions.mjs'
import { TEST_POCKETBASE_URL, TEST_POST } from './support/test-data.mjs'

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await resetPocketBaseFixture()
})

test('otevře aplikaci proti deterministickému PocketBase', async ({ page, request }) => {
  const health = await request.get(`${TEST_POCKETBASE_URL}/api/health`)
  expect(health.status()).toBe(200)

  const response = await page.goto('/')
  expectHttpResponse(response, {
    status: 200,
    headers: { 'content-type': 'text/html' },
  })
  await expect(page.getByRole('heading', { name: 'Moniké' })).toBeVisible()

  await page.goto('/blog')
  await expect(page.getByRole('heading', { name: TEST_POST.title })).toBeVisible()
})

test('pomocník přihlásí vlastníka přes kolekci admins', async ({ page }) => {
  const client = await authenticateTestAdmin()
  expect(client.authStore.isValid).toBe(true)
  expect(client.authStore.record.collectionName).toBe('admins')

  await loginAsTestAdmin(page)
  await expect(page.getByRole('heading', { name: 'Blog', exact: true })).toBeVisible()
})

test('landing page nemá automaticky zjistitelné axe porušení', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
