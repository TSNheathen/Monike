import PocketBase, { BaseAuthStore } from 'pocketbase'
import { buildRuntimePolicy } from './lib/runtime-policy.mjs'

const policy = buildRuntimePolicy(process.env)
const apiUrl = process.env.POCKETBASE_ADMIN_URL || process.env.MONIKE_PUBLIC_POCKETBASE_URL
const email = process.env.POCKETBASE_SUPERUSER_EMAIL
const password = process.env.POCKETBASE_SUPERUSER_PASSWORD

if (!email || !password) {
  throw new Error(
    'POCKETBASE_SUPERUSER_EMAIL a POCKETBASE_SUPERUSER_PASSWORD jsou povinné pro reconciliaci.',
  )
}

const client = new PocketBase(apiUrl, new BaseAuthStore())
await client.collection('_superusers').authWithPassword(email, password)
await client.settings.update(policy.settings)
client.authStore.clear()

console.log(
  `PocketBase runtime policy (${policy.appEnvironment}) je aplikována. ` +
    `Proces musí být spuštěn s --origins ${policy.origins.join(',')}`,
)
