const { reconcileRuntimeSettings } = require('../../pb_hooks/lib/runtime-settings.js')

function settingsFixture() {
  return {
    meta: {},
    superuserIPs: [],
    rateLimits: {},
    trustedProxy: {},
    batch: {},
    backups: { s3: {} },
    logs: {},
  }
}

const environment = {
  APP_ENV: 'demo',
  MONIKE_ENV: 'demo',
  MONIKE_PUBLIC_POCKETBASE_URL: 'https://api-demo.monike.test',
  MONIKE_SUPERUSER_IPS: '192.0.2.24/32',
  MONIKE_BACKUP_STORAGE: 's3',
  MONIKE_S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  MONIKE_S3_BUCKET: 'monike-demo-backups',
  MONIKE_S3_REGION: 'auto',
  MONIKE_S3_ACCESS_KEY_ID: 'access-key',
  MONIKE_S3_SECRET_ACCESS_KEY: 'secret-key',
}

describe('PocketBase bootstrap runtime settings', () => {
  it('aplikuje bezpečnost, backup a log policy přímo při startu', () => {
    const settings = settingsFixture()
    let saved
    const result = reconcileRuntimeSettings(
      { settings: () => settings, save: (value) => { saved = value } },
      (name) => environment[name],
    )
    expect(result).toEqual({ environment: 'demo', backupRetention: 14 })
    expect(saved).toBe(settings)
    expect(settings).toMatchObject({
      meta: { appURL: 'https://api-demo.monike.test', hideControls: true },
      superuserIPs: ['192.0.2.24/32'],
      trustedProxy: { headers: ['X-Monike-Client-IP'], useLeftmostIP: false },
      backups: {
        cron: '15 2 * * *',
        cronMaxKeep: 14,
        s3: { enabled: true, bucket: 'monike-demo-backups', forcePathStyle: true },
      },
      logs: { maxDays: 14, minLevel: 0, logIP: true, logAuthId: true },
    })
  })

  it('selže zavřeně při chybějící kritické hodnotě nebo konfliktu prostředí', () => {
    expect(() => reconcileRuntimeSettings(
      { settings: settingsFixture },
      (name) => ({ ...environment, MONIKE_S3_SECRET_ACCESS_KEY: '' })[name],
    )).toThrow()
    expect(() => reconcileRuntimeSettings(
      { settings: settingsFixture },
      (name) => ({ ...environment, MONIKE_ENV: 'production' })[name],
    )).toThrow()
    expect(() => reconcileRuntimeSettings(
      { settings: settingsFixture },
      (name) => ({ ...environment, MONIKE_SUPERUSER_IPS: '0.0.0.0/0' })[name],
    )).toThrow()
  })
})
