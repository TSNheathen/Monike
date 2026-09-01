function commandOutput(value) {
  if (typeof value === 'string') return value
  if (typeof Buffer !== 'undefined') return Buffer.from(value).toString('utf8')
  if (typeof toString === 'function') return toString(value)
  throw new Error('command output cannot be decoded')
}

function parsePortableDf(output) {
  const lines = String(output || '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
  if (lines.length < 2) throw new Error('df did not return a filesystem row')
  const fields = lines[lines.length - 1].trim().split(/\s+/)
  if (fields.length < 5) throw new Error('df returned an unexpected row')
  const availableKib = Number(fields[3])
  const usedPercent = Number(String(fields[4]).replace('%', ''))
  if (!Number.isFinite(availableKib) || !Number.isFinite(usedPercent)) {
    throw new Error('df returned invalid capacity values')
  }
  return {
    availableBytes: availableKib * 1024,
    usedPercent,
  }
}

function checkStorageHealth(app, osApi) {
  const system = osApi || $os
  const dataDir = app.dataDir()
  const probe = `${dataDir}/.monike-storage-write-probe`
  const info = system.stat(dataDir)
  if (!info.isDir()) throw new Error('data directory is missing')

  try {
    system.writeFile(probe, 'storage-health', 0o600)
  } finally {
    try {
      system.remove(probe)
    } catch (_) {
      // Preserve the original probe error, if any.
    }
  }

  const capacity = parsePortableDf(commandOutput(system.cmd('/bin/df', '-Pk', dataDir).output()))
  return {
    ...capacity,
    healthy: capacity.usedPercent < 80 && capacity.availableBytes >= 1024 * 1024 * 1024,
  }
}

module.exports = {
  checkStorageHealth,
  parsePortableDf,
}
