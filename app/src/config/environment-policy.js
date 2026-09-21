export const APP_ENVIRONMENTS = Object.freeze([
  'development',
  'test',
  'demo',
  'production',
])

function parseBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error('VITE_USE_DEV_FIXTURES musí být true nebo false.')
}

export function resolveEnvironment({ mode, appEnvironment, devFixtures }) {
  const name = appEnvironment || (mode === 'development' ? 'development' : mode)

  if (!APP_ENVIRONMENTS.includes(name)) {
    throw new Error(`Neznámé prostředí Moniké: ${name}`)
  }

  const useDevFixtures = parseBoolean(devFixtures, false)

  if (useDevFixtures && name !== 'development') {
    throw new Error(
      `DEV fixtures nelze zapnout v prostředí ${name}. ` +
        'Nastav VITE_USE_DEV_FIXTURES=false.',
    )
  }

  return Object.freeze({ name, useDevFixtures })
}

function exactHttpsOrigin(value, name) {
  if (!value) throw new Error(`${name} je povinné pro nasazený build.`)
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} musí být platný HTTPS origin.`)
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.origin !== value) {
    throw new Error(`${name} musí být přesný HTTPS origin bez cesty.`)
  }
  return url.origin
}

export function validateDeploymentEnvironment({
  appEnvironment,
  pocketBaseUrl,
  siteUrl,
}) {
  const isExplicitDeployment = ['demo', 'production'].includes(appEnvironment)
  if (!isExplicitDeployment) return null
  return Object.freeze({
    pocketBaseOrigin: exactHttpsOrigin(pocketBaseUrl, 'VITE_POCKETBASE_URL'),
    siteOrigin: exactHttpsOrigin(siteUrl, 'VITE_SITE_URL'),
  })
}
