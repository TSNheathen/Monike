const DEPLOYED_ENVIRONMENTS = new Set(['demo', 'production'])

function required(value, name) {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`${name} je povinné.`)
  return normalized
}

function parseHttpsOrigin(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Neplatný povolený origin: ${value}`)
  }
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password) {
    throw new Error(`Povolený origin musí být přesný HTTPS origin bez cesty: ${value}`)
  }
  return url.origin
}

function parseOrigins(value) {
  const origins = required(value, 'MONIKE_ALLOWED_ORIGINS')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (!origins.length || origins.includes('*') || origins.includes('null')) {
    throw new Error('CORS allowlist nesmí být prázdný ani obsahovat * nebo null.')
  }
  return [...new Set(origins.map(parseHttpsOrigin))]
}

function parseSuperuserIps(value) {
  const entries = required(value, 'MONIKE_SUPERUSER_IPS')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (
    !entries.length ||
    entries.some((item) => /\s/.test(item) || item === '0.0.0.0/0' || item === '::/0')
  ) {
    throw new Error('Superuser IP allowlist je prázdný nebo příliš široký.')
  }
  return [...new Set(entries)]
}

function parseR2Config(environment) {
  return {
    enabled: true,
    bucket: required(environment.MONIKE_R2_BUCKET, 'MONIKE_R2_BUCKET'),
    region: required(environment.MONIKE_R2_REGION, 'MONIKE_R2_REGION'),
    endpoint: parseHttpsOrigin(
      required(environment.MONIKE_R2_ENDPOINT, 'MONIKE_R2_ENDPOINT'),
    ),
    accessKey: required(environment.MONIKE_R2_ACCESS_KEY_ID, 'MONIKE_R2_ACCESS_KEY_ID'),
    secret: required(environment.MONIKE_R2_SECRET_ACCESS_KEY, 'MONIKE_R2_SECRET_ACCESS_KEY'),
    forcePathStyle: true,
  }
}

export function buildRuntimePolicy(environment) {
  const appEnvironment = required(environment.APP_ENV, 'APP_ENV')
  if (!DEPLOYED_ENVIRONMENTS.has(appEnvironment)) {
    throw new Error('Runtime policy lze aplikovat jen pro APP_ENV=demo nebo production.')
  }
  const monikeEnvironment = required(environment.MONIKE_ENV, 'MONIKE_ENV')
  if (monikeEnvironment !== appEnvironment) {
    throw new Error('APP_ENV a MONIKE_ENV si odporují.')
  }
  const appURL = parseHttpsOrigin(
    required(environment.MONIKE_PUBLIC_POCKETBASE_URL, 'MONIKE_PUBLIC_POCKETBASE_URL'),
  )
  const origins = parseOrigins(environment.MONIKE_ALLOWED_ORIGINS)
  const superuserIPs = parseSuperuserIps(environment.MONIKE_SUPERUSER_IPS)
  const backupStorage = parseR2Config(environment)
  const backupRetention = appEnvironment === 'demo' ? 14 : 30

  return {
    appEnvironment,
    origins,
    settings: {
      meta: {
        appName: 'Moniké',
        appURL,
        hideControls: true,
      },
      superuserIPs,
      rateLimits: {
        enabled: true,
        rules: [
          {
            label: '*:auth',
            audience: '@guest',
            duration: 60,
            maxRequests: 5,
          },
          {
            label: 'POST /api/monike/content-assets/stage',
            audience: '@auth',
            duration: 600,
            maxRequests: 20,
          },
          {
            label: 'POST /api/monike/',
            audience: '@auth',
            duration: 60,
            maxRequests: 60,
          },
          {
            label: '/api/',
            audience: '@guest',
            duration: 60,
            maxRequests: 300,
          },
        ],
      },
      trustedProxy: {
        headers: ['Fly-Client-IP'],
        useLeftmostIP: false,
      },
      batch: {
        enabled: false,
        maxRequests: 50,
        timeout: 3,
        maxBodySize: 0,
      },
      backups: {
        cron: '15 2 * * *',
        cronMaxKeep: backupRetention,
        s3: backupStorage,
      },
      logs: {
        maxDataSize: 16384,
        maxDays: 14,
        minLevel: 0,
        logIP: true,
        logAuthId: true,
      },
    },
  }
}

export const LOCAL_POCKETBASE_ORIGINS = Object.freeze([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
])
