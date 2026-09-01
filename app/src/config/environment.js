import { resolveEnvironment } from './environment-policy.js'

const resolved = resolveEnvironment({
  mode: import.meta.env.MODE,
  appEnvironment: import.meta.env.VITE_APP_ENV,
  devFixtures: import.meta.env.VITE_USE_DEV_FIXTURES,
})

export const APP_ENVIRONMENT = resolved.name
export const DEV_FIXTURES_ENABLED = resolved.useDevFixtures
export const POCKETBASE_URL =
  import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'
export const SITE_ORIGIN = new URL(
  import.meta.env.VITE_SITE_URL || 'http://127.0.0.1:5173',
).origin
