import { createAppServer } from './app.js'

const port = Number(process.env.PORT || 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT musí být platné číslo portu.')
const server = createAppServer()
server.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log(`Moniké běží na portu ${port}.`)
})
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
