import { readFileSync } from 'node:fs'
import path from 'node:path'

const appRoot = process.cwd()
const read = (name) => readFileSync(path.join(appRoot, name), 'utf8')

describe('PocketBase release artefact', () => {
  it('připíná PocketBase 0.40.1, ověřuje checksum a nespouští update', () => {
    const dockerfile = read('Dockerfile.pocketbase')
    expect(dockerfile).toContain('ARG PB_VERSION=0.40.1')
    expect(dockerfile).toContain(
      'ARG PB_ARCHIVE_SHA256=0f3442d2e57b03b56fbff0d09289e4a30b4f561a44338c38d2dcd4a1a0cfa91e',
    )
    expect(dockerfile).toContain('sha256sum -c -')
    expect(dockerfile).toMatch(/alpine:3\.22\.1@sha256:[a-f0-9]{64}/)
    expect(dockerfile).not.toMatch(/\blatest\b|pocketbase update/)
  })

  it('omezuje Docker context na serverový artefakt bez dat a tajemství', () => {
    const ignored = read('.dockerignore')
    expect(ignored).toMatch(/^\*$/m)
    expect(ignored).toContain('!pb_hooks/**')
    expect(ignored).toContain('!pb_migrations/**')
    expect(ignored.match(/!public\/assets\/landing\/card-[^\n]+\.png/g)).toHaveLength(5)
    expect(ignored).not.toContain('!.env')
    expect(ignored).not.toContain('!pb_data')
  })

  it('ověří Volume a před spuštěním serve zahodí root oprávnění', () => {
    const entrypoint = read('docker/pocketbase-entrypoint.sh')
    expect(entrypoint).toContain('umask 027')
    expect(entrypoint).toContain('chmod 0750 /pb/pb_data')
    expect(entrypoint).toContain('su-exec 10001:10001')
    expect(entrypoint).toContain('--automigrate=0')
    expect(entrypoint).toContain('--encryptionEnv=PB_ENCRYPTION_KEY')
    expect(entrypoint).toContain('--origins="$MONIKE_ALLOWED_ORIGINS"')
    expect(entrypoint).not.toContain('--dev')
  })

  it('balí pět deterministic seed obrázků vyžadovaných fresh migrací', () => {
    const dockerfile = read('Dockerfile.pocketbase')
    expect(dockerfile).toContain(
      'COPY public/assets/landing/card-*.png /pb/public/assets/landing/',
    )
    expect(dockerfile).toContain('/pb/public')
  })
})

describe.each([
  ['demo', 'fly.demo.toml', 'monike_data_demo', '7'],
  ['production', 'fly.production.toml', 'monike_data_production', '14'],
])('Fly konfigurace %s', (environment, file, volume, snapshotRetention) => {
  it('udržuje jeden 1GB stroj ve fra a 5GB Volume bez autostopu', () => {
    const config = read(file)
    expect(config).toContain('primary_region = "fra"')
    expect(config).toContain(`MONIKE_ENV = "${environment}"`)
    expect(config).toContain(`source = "${volume}"`)
    expect(config).toContain('destination = "/pb/pb_data"')
    expect(config).toContain('initial_size = "5gb"')
    expect(config).toContain(`snapshot_retention = ${snapshotRetention}`)
    expect(config).toContain('auto_stop_machines = "off"')
    expect(config).toContain('min_machines_running = 1')
    expect(config).toContain('size = "shared-cpu-1x"')
    expect(config).toContain('memory = "1gb"')
    expect(config).toContain('policy = "always"')
    expect(config).toContain('path = "/api/health/ready"')
  })
})
