const DEPLOYED_ENVIRONMENTS = ['demo', 'production']

function required(getenv, name) {
  const value = String(getenv(name) || '').trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function splitList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function superuserIps(value) {
  const entries = splitList(value)
  if (!entries.length || entries.includes('0.0.0.0/0') || entries.includes('::/0')) {
    throw new Error('MONIKE_SUPERUSER_IPS is empty or too broad')
  }
  return entries
}

function reconcileRuntimeSettings(app, getenv) {
  const read = getenv || ((name) => $os.getenv(name))
  const environment = required(read, 'APP_ENV')
  if (!DEPLOYED_ENVIRONMENTS.includes(environment)) {
    throw new Error('APP_ENV must be demo or production')
  }
  if (required(read, 'MONIKE_ENV') !== environment) {
    throw new Error('APP_ENV and MONIKE_ENV conflict')
  }

  const settings = app.settings()
  settings.meta.appName = 'Moniké'
  settings.meta.appURL = required(read, 'MONIKE_PUBLIC_POCKETBASE_URL')
  settings.meta.hideControls = true
  settings.superuserIPs = superuserIps(required(read, 'MONIKE_SUPERUSER_IPS'))
  settings.rateLimits.enabled = true
  settings.rateLimits.rules = [
    { label: '*:auth', audience: '@guest', duration: 60, maxRequests: 5 },
    {
      label: 'POST /api/monike/content-assets/stage',
      audience: '@auth',
      duration: 600,
      maxRequests: 20,
    },
    {
      label: 'POST /api/monike/',
      audience: '@auth',
      duration: 60,
      maxRequests: 60,
    },
    { label: '/api/', audience: '@guest', duration: 60, maxRequests: 300 },
  ]
  settings.trustedProxy.headers = ['X-Monike-Client-IP']
  settings.trustedProxy.useLeftmostIP = false
  settings.batch.enabled = false
  settings.batch.maxRequests = 50
  settings.batch.timeout = 3
  settings.batch.maxBodySize = 0
  settings.backups.cron = '15 2 * * *'
  settings.backups.cronMaxKeep = environment === 'demo' ? 14 : 30
  const backupStorage = read('MONIKE_BACKUP_STORAGE') || 'local'
  if (!['local', 's3'].includes(backupStorage)) throw new Error('MONIKE_BACKUP_STORAGE musí být local nebo s3.')
  settings.backups.s3.enabled = backupStorage === 's3'
  if (backupStorage === 's3') {
    settings.backups.s3.endpoint = required(read, 'MONIKE_S3_ENDPOINT')
    settings.backups.s3.bucket = required(read, 'MONIKE_S3_BUCKET')
    settings.backups.s3.region = required(read, 'MONIKE_S3_REGION')
    settings.backups.s3.accessKey = required(read, 'MONIKE_S3_ACCESS_KEY_ID')
    settings.backups.s3.secret = required(read, 'MONIKE_S3_SECRET_ACCESS_KEY')
    settings.backups.s3.forcePathStyle = true
  }
  settings.logs.maxDataSize = 16384
  settings.logs.maxDays = 14
  settings.logs.minLevel = 0
  settings.logs.logIP = true
  settings.logs.logAuthId = true
  app.save(settings)

  return { environment, backupRetention: settings.backups.cronMaxKeep }
}

module.exports = { reconcileRuntimeSettings }
