import assert from 'node:assert/strict'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import PocketBase from 'pocketbase'
import {
  appRoot,
  ensurePocketBase,
  runPocketBase,
} from './lib/pocketbase.mjs'

const initialMigration = '20260610142000_initial_monike_collections.js'
const sourceMigrations = path.join(appRoot, 'pb_migrations')
const hooksDirectory = path.join(appRoot, 'pb_hooks')
const testRoot = path.join(appRoot, '.tmp', 'migration-tests')
const superuser = {
  email: 'migration-superuser@monike.test',
  password: 'Monike-migration-superuser-2026',
}

async function copyMigrations(destination, predicate = () => true) {
  await mkdir(destination, { recursive: true })
  const files = (await readdir(sourceMigrations))
    .filter((name) => name.endsWith('.js') && predicate(name))
    .sort()
  for (const name of files) {
    await copyFile(path.join(sourceMigrations, name), path.join(destination, name))
  }
}

async function migrate(dataDir, migrationsDir) {
  await runPocketBase(
    [
      'migrate',
      'up',
      '--dir',
      dataDir,
      '--migrationsDir',
      migrationsDir,
      '--hooksDir',
      hooksDirectory,
    ],
    { stdio: 'inherit' },
  )
}

async function upsertSuperuser(dataDir, migrationsDir) {
  await runPocketBase(
    [
      'superuser',
      'upsert',
      superuser.email,
      superuser.password,
      '--dir',
      dataDir,
      '--migrationsDir',
      migrationsDir,
      '--hooksDir',
      hooksDirectory,
    ],
    { stdio: 'ignore' },
  )
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Testovací PocketBase skončil s kódem ${child.exitCode}.`)
    }
    try {
      const response = await fetch(`${url}/api/health`)
      if (response.ok) return
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`PocketBase se nespustil na ${url}.`)
}

async function withServer({ dataDir, migrationsDir, port }, callback) {
  const executable = await ensurePocketBase()
  const url = `http://127.0.0.1:${port}`
  const child = spawn(
    executable,
    [
      'serve',
      '--automigrate=false',
      '--http',
      `127.0.0.1:${port}`,
      '--dir',
      dataDir,
      '--migrationsDir',
      migrationsDir,
      '--hooksDir',
      hooksDirectory,
    ],
    { stdio: 'ignore' },
  )

  try {
    await waitForHealth(url, child)
    await callback(url)
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM')
      await new Promise((resolve) => child.once('exit', resolve))
    }
  }
}

async function superuserClient(url) {
  const client = new PocketBase(url)
  await client
    .collection('_superusers')
    .authWithPassword(superuser.email, superuser.password)
  return client
}

async function assertFinalSchema(url) {
  const client = await superuserClient(url)
  const [admins, posts, gallery, aliases, site, cards, about, assets] =
    await Promise.all([
      client.collections.getOne('admins'),
      client.collections.getOne('posts'),
      client.collections.getOne('gallery_images'),
      client.collections.getOne('post_slug_aliases'),
      client.collections.getOne('site_content'),
      client.collections.getOne('landing_cards'),
      client.collections.getOne('about_page'),
      client.collections.getOne('content_assets'),
    ])

  assert.equal(admins.authToken.duration, 28_800)
  assert.equal(admins.listRule, null)
  const categories = posts.fields.find((field) => field.name === 'categories')
  assert.deepEqual(categories.values, [
    'cesty',
    'vzpominky',
    'kocicky-andy',
    'proces-tvorby',
  ])
  assert.equal(categories.required, true)
  assert.equal(posts.fields.find((field) => field.name === 'cover_image').protected, true)
  assert.equal(posts.createRule, null)
  assert.equal(posts.deleteRule, null)
  assert.match(posts.updateRule, /content_html:isset = false/)
  assert.equal(gallery.fields.find((field) => field.name === 'image').protected, true)
  assert.match(aliases.listRule, /post\.published = true/)
  assert.equal(aliases.createRule, null)
  assert.equal(aliases.updateRule, null)
  assert.equal(aliases.deleteRule, null)
  assert.equal(site.createRule, null)
  assert.equal(site.deleteRule, null)
  assert.equal(cards.createRule, null)
  assert.equal(cards.deleteRule, null)
  assert.equal(about.createRule, null)
  assert.equal(assets.fields.find((field) => field.name === 'image').protected, true)
  assert.equal(assets.createRule, null)
  assert.equal(assets.updateRule, null)
  assert.equal(assets.deleteRule, null)

  const [siteRecords, cardRecords, aboutRecords] = await Promise.all([
    client.collection('site_content').getFullList(),
    client.collection('landing_cards').getFullList(),
    client.collection('about_page').getFullList(),
  ])
  assert.equal(siteRecords.length, 1)
  assert.equal(siteRecords[0].key, 'main')
  assert.equal(cardRecords.length, 5)
  assert.deepEqual(
    cardRecords.map((record) => record.slot).sort(),
    ['gallery', 'cesty', 'vzpominky', 'kocicky-andy', 'proces-tvorby'].sort(),
  )
  assert.equal(aboutRecords.length, 1)
  assert.equal(aboutRecords[0].key, 'main')
}

async function testFreshMigration() {
  const root = path.join(testRoot, 'fresh')
  const dataDir = path.join(root, 'data')
  const migrationsDir = path.join(root, 'migrations')
  await rm(root, { recursive: true, force: true })
  await copyMigrations(migrationsDir)
  await migrate(dataDir, migrationsDir)
  await upsertSuperuser(dataDir, migrationsDir)
  await withServer({ dataDir, migrationsDir, port: 8092 }, assertFinalSchema)
  console.log('PASS fresh: všechny migrace z prázdné databáze')
}

async function testPrototypeUpgrade() {
  const root = path.join(testRoot, 'upgrade')
  const dataDir = path.join(root, 'data')
  const migrationsDir = path.join(root, 'migrations')
  await rm(root, { recursive: true, force: true })
  await copyMigrations(migrationsDir, (name) => name === initialMigration)
  await migrate(dataDir, migrationsDir)
  await upsertSuperuser(dataDir, migrationsDir)

  let legacyId = ''
  await withServer({ dataDir, migrationsDir, port: 8093 }, async (url) => {
    const client = await superuserClient(url)
    const legacy = await client.collection('posts').create({
      title: 'Starší nezařazený článek',
      slug: 'starsi-nezarazeny-clanek',
      excerpt: 'Záznam vytvořený podle prototypového schématu.',
      content_html: '<p>Původní obsah.</p>',
      content_json: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Původní obsah.' }] }],
      },
      published: true,
      published_at: '2026-06-10 12:00:00.000Z',
    })
    legacyId = legacy.id
  })

  await copyMigrations(migrationsDir, (name) => name !== initialMigration)
  await migrate(dataDir, migrationsDir)

  await withServer({ dataDir, migrationsDir, port: 8093 }, async (url) => {
    await assertFinalSchema(url)
    const client = await superuserClient(url)
    const legacy = await client.collection('posts').getOne(legacyId)
    assert.deepEqual(legacy.categories, [])
    assert.equal(legacy.published, true)

    const guest = new PocketBase(url)
    const publicPosts = await guest.collection('posts').getFullList()
    assert.equal(publicPosts.some((record) => record.id === legacyId), false)
  })

  console.log('PASS upgrade: prototypová data zůstala zachována bez odhadu kategorií')
}

await rm(testRoot, { recursive: true, force: true })
await mkdir(testRoot, { recursive: true })
await testFreshMigration()
await testPrototypeUpgrade()
