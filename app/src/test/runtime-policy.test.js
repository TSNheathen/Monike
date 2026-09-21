import { buildRuntimePolicy, LOCAL_POCKETBASE_ORIGINS } from '../../scripts/lib/runtime-policy.mjs'

const validEnvironment = {
  APP_ENV: 'demo',
  MONIKE_ENV: 'demo',
  MONIKE_PUBLIC_POCKETBASE_URL: 'https://api-demo.monike.test',
  MONIKE_ALLOWED_ORIGINS: 'https://demo.monike.test',
  MONIKE_SUPERUSER_IPS: '192.0.2.24/32',
  MONIKE_BACKUP_STORAGE: 's3',
  MONIKE_S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  MONIKE_S3_BUCKET: 'monike-demo-backups',
  MONIKE_S3_REGION: 'auto',
  MONIKE_S3_ACCESS_KEY_ID: 'demo-access-key',
  MONIKE_S3_SECRET_ACCESS_KEY: 'demo-secret-key',
}

describe('PocketBase runtime policy', () => {
  it('na Roští nevyžaduje S3 a zachová denní konzistentní lokální zálohy', () => {
    const policy = buildRuntimePolicy({ ...validEnvironment, MONIKE_BACKUP_STORAGE: 'local' })
    expect(policy.settings.backups.s3).toEqual({ enabled: false })
    expect(policy.settings.backups.cron).toBe('15 2 * * *')
    expect(() => buildRuntimePolicy({ ...validEnvironment, MONIKE_BACKUP_STORAGE: 'unknown' })).toThrow()
  })
  it('připraví přesné CORS, interní proxy, rate limits a skrytí schema ovládání', () => {
    const policy = buildRuntimePolicy(validEnvironment)
    expect(policy.origins).toEqual(['https://demo.monike.test'])
    expect(policy.settings).toMatchObject({
      meta: { appURL: 'https://api-demo.monike.test', hideControls: true },
      superuserIPs: ['192.0.2.24/32'],
      trustedProxy: { headers: ['X-Monike-Client-IP'], useLeftmostIP: false },
      rateLimits: { enabled: true },
      backups: {
        cron: '15 2 * * *',
        cronMaxKeep: 14,
        s3: {
          enabled: true,
          endpoint: 'https://account.r2.cloudflarestorage.com',
          bucket: 'monike-demo-backups',
          forcePathStyle: true,
        },
      },
      logs: { maxDays: 14, minLevel: 0, logIP: true, logAuthId: true },
    })
    expect(policy.settings.rateLimits.rules).toContainEqual({
      label: '*:auth',
      audience: '@guest',
      duration: 60,
      maxRequests: 5,
    })
    expect(LOCAL_POCKETBASE_ORIGINS).toContain('http://127.0.0.1:4173')
  })

  it('selže zavřeně pro neznámé prostředí a široký či nepřesný allowlist', () => {
    for (const override of [
      { APP_ENV: 'development' },
      { MONIKE_ENV: 'production' },
      { MONIKE_ALLOWED_ORIGINS: '*' },
      { MONIKE_ALLOWED_ORIGINS: 'https://demo.monike.test/cesta' },
      { MONIKE_ALLOWED_ORIGINS: 'http://demo.monike.test' },
      { MONIKE_SUPERUSER_IPS: '0.0.0.0/0' },
      { MONIKE_S3_ENDPOINT: 'http://account.r2.cloudflarestorage.com' },
      { MONIKE_S3_SECRET_ACCESS_KEY: '' },
    ]) {
      expect(() => buildRuntimePolicy({ ...validEnvironment, ...override })).toThrow()
    }
  })

  it('použije v produkci třicet rotujících denních záloh', () => {
    const policy = buildRuntimePolicy({
      ...validEnvironment,
      APP_ENV: 'production',
      MONIKE_ENV: 'production',
    })
    expect(policy.settings.backups.cronMaxKeep).toBe(30)
  })
})
