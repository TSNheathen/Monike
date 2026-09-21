import { configDefaults, defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {
  resolveEnvironment,
  validateDeploymentEnvironment,
} from './src/config/environment-policy.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const environment = resolveEnvironment({
    mode,
    appEnvironment: env.VITE_APP_ENV,
    devFixtures: env.VITE_USE_DEV_FIXTURES,
  })
  validateDeploymentEnvironment({
    appEnvironment: environment.name,
    pocketBaseUrl: env.VITE_POCKETBASE_URL,
    siteUrl: env.VITE_SITE_URL,
  })

  return {
    plugins: [
      react(),
      {
        name: 'monike-environment-metadata',
        transformIndexHtml(html) {
          const robots = environment.name === 'production' ? 'index,follow' : 'noindex,nofollow'
          return html.replace(
            /<meta\s+name=["']robots["'][^>]*>/i,
            `<meta name="robots" content="${robots}">`,
          )
        },
      },
    ],
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'tests/e2e/**'],
      globals: true,
      setupFiles: './src/test/setup.js',
    },
  }
})
