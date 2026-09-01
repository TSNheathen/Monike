import { spawn } from 'node:child_process'
import path from 'node:path'
import {
  POCKETBASE_VERSION,
  appRoot,
  ensurePocketBase,
  pocketBaseArgs,
} from './lib/pocketbase.mjs'

const action = process.argv[2] || 'serve'
const executable = await ensurePocketBase()

if (action === 'download') {
  console.log(`PocketBase ${POCKETBASE_VERSION}: ${executable}`)
  process.exit(0)
}

if (action !== 'serve') {
  console.error('Použití: node scripts/pocketbase.mjs [download|serve]')
  process.exit(1)
}

const child = spawn(
  executable,
  pocketBaseArgs({
    command: 'serve',
    dataDir: path.join(appRoot, 'pb_data'),
    http: process.env.POCKETBASE_HTTP || '127.0.0.1:8090',
    origins: process.env.MONIKE_ALLOWED_ORIGINS
      ? process.env.MONIKE_ALLOWED_ORIGINS.split(',').map((item) => item.trim())
      : undefined,
  }),
  { stdio: 'inherit' },
)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.once('error', (error) => {
  console.error(error)
  process.exit(1)
})
child.once('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
