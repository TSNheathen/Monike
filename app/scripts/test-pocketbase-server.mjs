import { mkdir, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import {
  appRoot,
  ensurePocketBase,
  pocketBaseArgs,
  runPocketBase,
} from './lib/pocketbase.mjs'
import { TEST_SUPERUSER } from '../tests/e2e/support/test-data.mjs'

const dataDir = path.join(appRoot, '.tmp', 'pocketbase-e2e')
await rm(dataDir, { recursive: true, force: true })
await mkdir(dataDir, { recursive: true })

await runPocketBase(
  pocketBaseArgs({ dataDir, command: 'migrate' }).concat('up'),
  { stdio: 'inherit' },
)
await runPocketBase(
  [
    'superuser',
    'upsert',
    TEST_SUPERUSER.email,
    TEST_SUPERUSER.password,
    '--dir',
    dataDir,
    '--migrationsDir',
    path.join(appRoot, 'pb_migrations'),
  ],
  { stdio: 'inherit' },
)

const executable = await ensurePocketBase()
const child = spawn(
  executable,
  pocketBaseArgs({
    dataDir,
    command: 'serve',
    http: process.env.POCKETBASE_TEST_HTTP || '127.0.0.1:8095',
  }),
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      MONIKE_TEST_MODE: 'true',
      MONIKE_PUBLIC_POCKETBASE_URL: `http://${process.env.POCKETBASE_TEST_HTTP || '127.0.0.1:8095'}`,
    },
  },
)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.once('error', (error) => {
  console.error(error)
  process.exit(1)
})
child.once('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
