// @vitest-environment node
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createAppServer } from '../../server/app.js'

const servers = []
const directories = []

async function listen(server) {
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true })
})

async function startProxy({ trustProxy = false } = {}) {
  const backend = await listen(createServer(async (request, response) => {
    const body = []
    for await (const chunk of request) body.push(chunk)
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' })
    response.end(JSON.stringify({ headers: request.headers, body: Buffer.concat(body).toString(), path: request.url }))
  }))
  return listen(createAppServer({ environment: {
    MONIKE_ENV: 'production',
    MONIKE_SITE_URL: 'https://monike.example',
    MONIKE_POCKETBASE_URL: 'https://monike.example',
    MONIKE_POCKETBASE_INTERNAL_URL: backend,
    MONIKE_TRUST_PROXY: String(trustProxy),
  } }))
}

it('streamuje tělo/token a zachová private cache; ignoruje klientské proxy hlavičky při přímém běhu', async () => {
  const origin = await startProxy()
  const result = await fetch(`${origin}/api/files/example?token=protected`, {
    method: 'POST',
    headers: {
      authorization: 'owner-token',
      'content-type': 'application/octet-stream',
      'x-real-ip': '203.0.113.9',
      'x-forwarded-for': '203.0.113.9',
      'fly-client-ip': '203.0.113.9',
      'x-monike-client-ip': '203.0.113.9',
    },
    body: 'upload bytes',
  })
  expect(result.headers.get('cache-control')).toBe('private, no-store')
  const received = await result.json()
  expect(received.path).toBe('/api/files/example?token=protected')
  expect(received.body).toBe('upload bytes')
  expect(received.headers.authorization).toBe('owner-token')
  expect(received.headers['x-monike-client-ip']).toBe('127.0.0.1')
  expect(received.headers).not.toHaveProperty('x-real-ip')
  expect(received.headers).not.toHaveProperty('x-forwarded-for')
  expect(received.headers).not.toHaveProperty('fly-client-ip')
})

it('za hostingovou proxy vyžaduje jednoznačnou IP a přepíše interní důvěryhodný header', async () => {
  const origin = await startProxy({ trustProxy: true })
  for (const ip of ['', 'bad-ip', '203.0.113.9, 127.0.0.1']) {
    expect((await fetch(`${origin}/api/health`, { headers: { 'x-real-ip': ip } })).status).toBe(400)
  }
  const response = await fetch(`${origin}/_/`, {
    headers: { 'x-real-ip': '2001:db8::1', 'x-monike-client-ip': '127.0.0.1' },
  })
  expect((await response.json()).headers['x-monike-client-ip']).toBe('2001:db8::1')
})

it('servíruje build s MIME/cache/HEAD, nezveřejní dotfiles a nevrací index pro neznámé cesty', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'monike-http-test-'))
  directories.push(directory)
  await writeFile(path.join(directory, 'app.js'), 'window.ready = true')
  await writeFile(path.join(directory, '.private.json'), '{"secret":true}')
  const origin = await listen(createAppServer({
    distDir: directory,
    loadHtml: async (name) => `<html>${name}</html>`,
    environment: { MONIKE_ENV: 'test', MONIKE_SITE_URL: 'http://127.0.0.1', MONIKE_POCKETBASE_URL: 'http://127.0.0.1:8095' },
  }))
  const script = await fetch(`${origin}/app.js`)
  expect(script.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
  expect(script.headers.get('x-content-type-options')).toBe('nosniff')
  expect(await script.text()).toBe('window.ready = true')
  const head = await fetch(`${origin}/app.js`, { method: 'HEAD' })
  expect(head.status).toBe(200)
  expect(await head.text()).toBe('')
  expect((await fetch(`${origin}/.private.json`)).status).toBe(404)
  expect((await fetch(`${origin}/missing.js`)).status).toBe(404)
  expect((await fetch(`${origin}/admin/web/landing`)).status).toBe(200)
  expect((await fetch(`${origin}/blog`, { method: 'POST' })).status).toBe(405)
})
