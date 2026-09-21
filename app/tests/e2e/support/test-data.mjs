const pocketBaseHttp = process.env.MONIKE_E2E_POCKETBASE_HTTP || '127.0.0.1:8095'

export const TEST_POCKETBASE_URL = `http://${pocketBaseHttp}`

export const TEST_SUPERUSER = Object.freeze({
  email: 'superuser@monike.test',
  password: 'Monike-superuser-2026',
})

export const TEST_ADMIN = Object.freeze({
  email: 'monike@monike.test',
  password: 'Monike-admin-2026',
})

export const TEST_POST = Object.freeze({
  title: 'Deterministický testovací článek',
  slug: 'deterministicky-testovaci-clanek',
  excerpt: 'Obsah vytvořený výhradně lokálním testovacím prostředím.',
})
