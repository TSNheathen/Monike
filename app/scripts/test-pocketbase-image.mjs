import { execFileSync, spawnSync } from 'node:child_process'

const containerName = `monike-pocketbase-smoke-${process.pid}`
const imageName = 'monike-pocketbase:phase7-smoke'

function docker(args, options = {}) {
  return execFileSync('docker', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })
}

try {
  docker(['build', '--file', 'Dockerfile.pocketbase', '--tag', imageName, '.'])
  docker([
    'run', '--detach', '--name', containerName,
    '-e', 'APP_ENV=demo',
    '-e', 'MONIKE_ENV=demo',
    '-e', 'MONIKE_PUBLIC_POCKETBASE_URL=https://api-demo.monike.test',
    '-e', 'MONIKE_ALLOWED_ORIGINS=https://demo.monike.test',
    '-e', 'PB_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef',
    '-e', 'MONIKE_SUPERUSER_IPS=127.0.0.1/32',
    '-e', 'MONIKE_R2_ENDPOINT=https://account.r2.cloudflarestorage.com',
    '-e', 'MONIKE_R2_BUCKET=monike-demo-backups',
    '-e', 'MONIKE_R2_REGION=auto',
    '-e', 'MONIKE_R2_ACCESS_KEY_ID=local-smoke-key',
    '-e', 'MONIKE_R2_SECRET_ACCESS_KEY=local-smoke-secret',
    '-e', 'MONIKE_BACKUP_HEARTBEAT_URL=https://uptime.example/backup-token',
    '-e', 'MONIKE_CLEANUP_HEARTBEAT_URL=https://uptime.example/cleanup-token',
    '-e', 'MONIKE_STORAGE_HEARTBEAT_URL=https://uptime.example/storage-token',
    imageName,
  ])

  let ready = ''
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = spawnSync(
      'docker',
      ['exec', containerName, 'wget', '-qO-', 'http://127.0.0.1:8080/api/health/ready'],
      { encoding: 'utf8' },
    )
    if (response.status === 0) {
      ready = response.stdout
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (ready.trim() !== '{"status":"ready"}') {
    throw new Error(`Readiness neprošla: ${ready || docker(['logs', containerName], { capture: true })}`)
  }

  const processes = docker(['top', containerName, '-eo', 'pid,user,args'], { capture: true })
  if (!/^\s*\d+\s+10001\s+\/pb\/pocketbase serve/m.test(processes)) {
    throw new Error(`PocketBase neběží jako uid 10001:\n${processes}`)
  }
  const permissions = docker([
    'exec', containerName, 'stat', '-c', '%u:%g %a %n',
    '/pb/pb_data', '/pb/pb_hooks', '/pb/pb_migrations', '/pb/public',
  ], { capture: true })
  if (!permissions.includes('10001:10001 750 /pb/pb_data')) {
    throw new Error(`Volume nemá očekávané vlastnictví/práva:\n${permissions}`)
  }

  console.log('PASS image: checksum build, fresh migrace, readiness, non-root runtime a Volume práva')
} finally {
  spawnSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' })
}
