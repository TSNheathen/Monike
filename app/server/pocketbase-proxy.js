import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'

const HOP_HEADERS = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']

function endToEndHeaders(headers) {
  const result = { ...headers }
  const connectionHeaders = String(headers.connection || '').toLowerCase().split(',').map((name) => name.trim())
  for (const name of [...HOP_HEADERS, ...connectionHeaders]) delete result[name]
  return result
}

export function proxyPocketBase(request, response, { target, trustProxy }) {
  const upstream = new URL(target)
  const headers = endToEndHeaders(request.headers)
  const clientIp = trustProxy ? request.headers['x-real-ip'] : request.socket.remoteAddress?.replace(/^::ffff:/, '')
  if (!isIP(String(clientIp || ''))) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end('Chybí platná adresa klienta od reverzní proxy.')
    return
  }
  // Only the hosting proxy may supply X-Real-IP. The backend never sees client-supplied forwarding headers.
  for (const name of Object.keys(headers)) {
    if (name === 'forwarded' || name.startsWith('x-forwarded-') || name === 'x-real-ip' || name === 'fly-client-ip' || name === 'x-monike-client-ip') delete headers[name]
  }
  headers.host = upstream.host
  headers['x-monike-client-ip'] = clientIp
  const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest
  const outgoing = send(upstream, {
    method: request.method,
    path: request.url,
    headers,
  }, (incoming) => {
    response.writeHead(incoming.statusCode, endToEndHeaders(incoming.headers))
    // Stream multipart uploads, files and realtime events without buffering them.
    incoming.pipe(response)
    incoming.on('error', () => response.destroy())
  })
  outgoing.setTimeout(120_000, () => outgoing.destroy(new Error('Upstream timeout')))
  outgoing.on('error', () => {
    if (response.headersSent) response.destroy()
    else {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60' })
      response.end('Server s obsahem teď není dostupný.')
    }
  })
  request.on('aborted', () => outgoing.destroy())
  response.on('close', () => outgoing.destroy())
  request.pipe(outgoing)
}
