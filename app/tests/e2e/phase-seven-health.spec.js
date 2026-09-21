import { expect, test } from '@playwright/test'
import { buildRuntimePolicy } from '../../scripts/lib/runtime-policy.mjs'
import { authenticateTestSuperuser } from './support/pocketbase-fixture.mjs'
import { TEST_POCKETBASE_URL } from './support/test-data.mjs'

test.describe.configure({ mode: 'serial' })

test('PocketBase liveness a readiness jsou veřejné, úzké a bez interních detailů', async () => {
  const live = await fetch(`${TEST_POCKETBASE_URL}/api/health/live`)
  expect(live.status).toBe(200)
  expect(live.headers.get('x-content-type-options')).toBe('nosniff')
  expect(live.headers.get('x-frame-options')).toBe('DENY')
  expect(live.headers.get('strict-transport-security')).toBeNull()
  expect(await live.json()).toEqual({ status: 'ok' })

  const ready = await fetch(`${TEST_POCKETBASE_URL}/api/health/ready`)
  expect(ready.status).toBe(200)
  expect(await ready.json()).toEqual({ status: 'ready' })
})

test('PocketBase 0.40.1 přijme přesnou runtime policy včetně R2 záloh a logů', async () => {
  const superuser = await authenticateTestSuperuser()
  const original = await superuser.settings.getAll()
  const policy = buildRuntimePolicy({
    APP_ENV: 'demo',
    MONIKE_ENV: 'demo',
    MONIKE_PUBLIC_POCKETBASE_URL: 'https://api-demo.monike.test',
    MONIKE_ALLOWED_ORIGINS: 'https://demo.monike.test',
    MONIKE_SUPERUSER_IPS: '127.0.0.1/32',
    MONIKE_BACKUP_STORAGE: 's3',
    MONIKE_S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    MONIKE_S3_BUCKET: 'monike-demo-backups',
    MONIKE_S3_REGION: 'auto',
    MONIKE_S3_ACCESS_KEY_ID: 'local-test-key',
    MONIKE_S3_SECRET_ACCESS_KEY: 'local-test-secret',
  })

  try {
    await superuser.settings.update(policy.settings)
    const saved = await superuser.settings.getAll()
    expect(saved.meta.hideControls).toBe(true)
    expect(saved.superuserIPs).toEqual(['127.0.0.1/32'])
    expect(saved.trustedProxy.headers).toEqual(['X-Monike-Client-IP'])
    expect(saved.backups).toMatchObject({
      cron: '15 2 * * *',
      cronMaxKeep: 14,
      s3: {
        enabled: true,
        bucket: 'monike-demo-backups',
        endpoint: 'https://account.r2.cloudflarestorage.com',
      },
    })
    expect(saved.logs).toMatchObject({ maxDays: 14, minLevel: 0 })
  } finally {
    await superuser.settings.update(original)
    superuser.authStore.clear()
  }
})
