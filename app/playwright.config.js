import { defineConfig, devices } from '@playwright/test'

const pocketBaseHttp = process.env.MONIKE_E2E_POCKETBASE_HTTP || '127.0.0.1:8095'
const pocketBaseUrl = `http://${pocketBaseHttp}`
const productionServer = process.env.MONIKE_E2E_PRODUCTION === 'true'
const appUrl = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: appUrl,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/test-pocketbase-server.mjs',
      url: `${pocketBaseUrl}/api/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        POCKETBASE_TEST_HTTP: pocketBaseHttp,
      },
    },
    {
      command: productionServer ? 'node server/start.js' : 'npm run dev -- --host 127.0.0.1 --port 4173',
      url: appUrl,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        MONIKE_ENV: 'test',
        MONIKE_SITE_URL: appUrl,
        MONIKE_POCKETBASE_URL: pocketBaseUrl,
        MONIKE_POCKETBASE_INTERNAL_URL: pocketBaseUrl,
        MONIKE_TRUST_PROXY: 'false',
        PORT: '4173',
        VITE_APP_ENV: 'test',
        VITE_USE_DEV_FIXTURES: 'false',
        VITE_POCKETBASE_URL: pocketBaseUrl,
        VITE_SITE_URL: appUrl,
      },
    },
  ],
})
