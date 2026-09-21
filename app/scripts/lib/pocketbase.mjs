import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { LOCAL_POCKETBASE_ORIGINS } from './runtime-policy.mjs'

export const POCKETBASE_VERSION = '0.40.1'
export const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)

function platformTarget() {
  const os = process.platform === 'win32' ? 'windows' : process.platform
  const architecture =
    process.arch === 'x64'
      ? 'amd64'
      : process.arch === 'arm64'
        ? 'arm64'
        : null

  if (!['darwin', 'linux', 'windows'].includes(os) || !architecture) {
    throw new Error(
      `PocketBase ${POCKETBASE_VERSION} není připravený pro ${process.platform}/${process.arch}.`,
    )
  }

  return { os, architecture }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio || 'inherit',
      ...options,
    })

    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} skončil (${code ?? signal}).`))
    })
  })
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Stažení ${url} selhalo: HTTP ${response.status}.`)
  }
  await writeFile(destination, Buffer.from(await response.arrayBuffer()))
}

async function extractArchive(archivePath, destination) {
  if (process.platform === 'win32') {
    await run(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:MONIKE_POCKETBASE_ARCHIVE, $env:MONIKE_POCKETBASE_DESTINATION)",
      ],
      {
        env: {
          ...process.env,
          MONIKE_POCKETBASE_ARCHIVE: archivePath,
          MONIKE_POCKETBASE_DESTINATION: destination,
        },
      },
    )
    return
  }

  await run('unzip', ['-o', archivePath, '-d', destination], { stdio: 'ignore' })
}

export async function ensurePocketBase() {
  const { os, architecture } = platformTarget()
  const target = `${os}_${architecture}`
  const directory = path.join(
    appRoot,
    'tools',
    'pocketbase',
    POCKETBASE_VERSION,
    target,
  )
  const executable = path.join(
    directory,
    process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase',
  )

  try {
    await readFile(executable)
    return executable
  } catch {
    // The pinned binary has not been installed for this platform yet.
  }

  await mkdir(directory, { recursive: true })

  const archiveName = `pocketbase_${POCKETBASE_VERSION}_${target}.zip`
  const releaseBase = `https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}`
  const archivePath = path.join(directory, `${archiveName}.download`)
  const checksumsPath = path.join(directory, 'checksums.txt.download')

  await Promise.all([
    download(`${releaseBase}/${archiveName}`, archivePath),
    download(`${releaseBase}/checksums.txt`, checksumsPath),
  ])

  const checksums = await readFile(checksumsPath, 'utf8')
  const checksumLine = checksums
    .split(/\r?\n/)
    .find((line) => line.trim().endsWith(archiveName))

  if (!checksumLine) {
    throw new Error(`Kontrolní součet pro ${archiveName} nebyl nalezen.`)
  }

  const expectedHash = checksumLine.trim().split(/\s+/)[0].toLowerCase()
  const actualHash = createHash('sha256')
    .update(await readFile(archivePath))
    .digest('hex')

  if (actualHash !== expectedHash) {
    throw new Error(`Kontrolní součet PocketBase ${POCKETBASE_VERSION} nesouhlasí.`)
  }

  const extractionDirectory = path.join(directory, 'extracting')
  await rm(extractionDirectory, { recursive: true, force: true })
  await mkdir(extractionDirectory, { recursive: true })
  await extractArchive(archivePath, extractionDirectory)

  const extractedExecutable = path.join(
    extractionDirectory,
    process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase',
  )
  await rename(extractedExecutable, executable)
  if (process.platform !== 'win32') await chmod(executable, 0o755)

  await rm(extractionDirectory, { recursive: true, force: true })
  await rm(archivePath, { force: true })
  await rm(checksumsPath, { force: true })

  return executable
}

export function pocketBaseArgs({ dataDir, http, command = 'serve', origins }) {
  const args = [
    command,
    '--dir',
    dataDir,
    '--migrationsDir',
    path.join(appRoot, 'pb_migrations'),
    '--hooksDir',
    path.join(appRoot, 'pb_hooks'),
  ]

  if (command === 'serve' && http) args.push('--http', http)
  if (command === 'serve') {
    const allowedOrigins = origins || LOCAL_POCKETBASE_ORIGINS
    args.push('--origins', allowedOrigins.join(','))
  }
  return args
}

export async function runPocketBase(args, options) {
  const executable = await ensurePocketBase()
  await run(executable, args, options)
}
