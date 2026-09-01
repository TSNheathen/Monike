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

  const useDevFixtures = parseBoolean(devFixtures, name === 'development')

  if (useDevFixtures && name !== 'development') {
    throw new Error(
      `DEV fixtures nelze zapnout v prostředí ${name}. ` +
        'Nastav VITE_USE_DEV_FIXTURES=false.',
    )
  }

  return Object.freeze({ name, useDevFixtures })
}
