/// <reference path="../pb_data/types.d.ts" />

routerUse((e) => {
  e.response.header().set('X-Content-Type-Options', 'nosniff')
  e.response.header().set('X-Frame-Options', 'DENY')
  const environment = $os.getenv('APP_ENV')
  if (environment === 'demo' || environment === 'production') {
    const maxAge = $os.getenv('MONIKE_API_HSTS_MAX_AGE') || '300'
    if (!/^(?:0|[1-9][0-9]{0,7})$/.test(maxAge) || Number(maxAge) > 31536000) {
      throw new Error('MONIKE_API_HSTS_MAX_AGE není platné.')
    }
    const includeSubDomains = $os.getenv('MONIKE_API_HSTS_INCLUDE_SUBDOMAINS') === 'true'
    if (includeSubDomains && maxAge !== '31536000') {
      throw new Error('API includeSubDomains vyžaduje roční HSTS.')
    }
    e.response.header().set(
      'Strict-Transport-Security',
      `max-age=${maxAge}${includeSubDomains ? '; includeSubDomains' : ''}`,
    )
  }
  return e.next()
})

function sendHeartbeat(environmentName) {
  const url = $os.getenv(environmentName)
  if (!url) throw new Error(`${environmentName} není nastavené.`)
  const response = $http.send({ method: 'GET', url, timeout: 10 })
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`${environmentName} vrátilo neúspěšný stav.`)
  }
}

function logHeartbeatFailure(app, event, error) {
  app.logger().error('monike.heartbeat.failed', 'event', event)
}

onBootstrap((e) => {
  e.next()
  if ($os.getenv('MONIKE_TEST_MODE') === 'true' || !$os.getenv('APP_ENV')) return
  const result = require(`${__hooks}/lib/runtime-settings.js`).reconcileRuntimeSettings(e.app)
  e.app.logger().info(
    'monike.runtime-settings.reconciled',
    'environment', result.environment,
    'backupRetention', result.backupRetention,
  )
})

routerAdd('POST', '/api/monike/content-assets/stage', (e) => {
  return require(`${__hooks}/lib/operations.js`).stageContentAsset(e)
}, $apis.bodyLimit(11 * 1024 * 1024))

routerAdd('POST', '/api/monike/posts/save', (e) => {
  return require(`${__hooks}/lib/operations.js`).savePost(e)
}, $apis.bodyLimit(2 * 1024 * 1024))

routerAdd('POST', '/api/monike/posts/{id}/delete', (e) => {
  return require(`${__hooks}/lib/operations.js`).deletePost(e)
}, $apis.bodyLimit(16 * 1024))

routerAdd('POST', '/api/monike/about/save', (e) => {
  return require(`${__hooks}/lib/operations.js`).saveAbout(e)
}, $apis.bodyLimit(2 * 1024 * 1024))

routerAdd('POST', '/api/monike/gallery/reorder', (e) => {
  return require(`${__hooks}/lib/operations.js`).reorderGallery(e)
}, $apis.bodyLimit(128 * 1024))

routerAdd('GET', '/api/monike/articles/{slug}', (e) => {
  return require(`${__hooks}/lib/operations.js`).resolveArticle(e)
})

routerAdd('GET', '/api/health/live', (e) => {
  return e.json(200, { status: 'ok' })
})

routerAdd('GET', '/api/health/ready', (e) => {
  const probe = `${e.app.dataDir()}/.monike-readiness-${$security.randomString(12)}`
  try {
    e.app.db().newQuery('SELECT 1').execute()
    const dataDirectory = $os.stat(e.app.dataDir())
    if (!dataDirectory.isDir()) throw new Error('data directory is missing')
    $os.writeFile(probe, 'ready', 0o600)
    $os.remove(probe)
    return e.json(200, { status: 'ready' })
  } catch (error) {
    try {
      $os.remove(probe)
    } catch (_) {
      // The probe may not have been created; readiness remains unavailable.
    }
    return e.json(503, { status: 'unavailable' })
  }
})

onFileDownloadRequest((e) => {
  const credentialed = e.requestEvent.request.url.query().get('token') !== '' || e.auth != null
  e.requestEvent.response.header().set(
    'Cache-Control',
    credentialed
      ? 'private, no-store'
      : 'public, max-age=2592000, stale-while-revalidate=86400',
  )
  e.next()
})

cronAdd('monikeInactiveAssetsCleanup', '30 3 * * *', () => {
  let result
  try {
    result = require(`${__hooks}/lib/operations.js`).cleanupInactiveAssets($app)
    $app.logger().info(
      'monike.cleanup.completed',
      'candidates', result.candidates,
      'deleted', result.deleted,
      'durationMs', result.durationMs,
    )
  } catch (error) {
    $app.logger().error('monike.cleanup.failed', 'error', String(error))
    return
  }
  try {
    sendHeartbeat('MONIKE_CLEANUP_HEARTBEAT_URL')
  } catch (error) {
    logHeartbeatFailure($app, 'cleanup', error)
  }
})

cronAdd('monikeStorageHealth', '7 * * * *', () => {
  let result
  try {
    result = require(`${__hooks}/lib/monitoring.js`).checkStorageHealth($app)
    if (!result.healthy) {
      $app.logger().warn(
        'monike.storage.threshold',
        'usedPercent', result.usedPercent,
        'availableBytes', result.availableBytes,
      )
      return
    }
  } catch (error) {
    $app.logger().error('monike.storage.failed', 'error', String(error))
    return
  }
  try {
    sendHeartbeat('MONIKE_STORAGE_HEARTBEAT_URL')
  } catch (error) {
    logHeartbeatFailure($app, 'storage', error)
  }
})

onBackupCreate((e) => {
  e.next()
  try {
    sendHeartbeat('MONIKE_BACKUP_HEARTBEAT_URL')
  } catch (error) {
    logHeartbeatFailure(e.app, 'backup', error)
  }
})

onRecordCreateRequest((e) => {
  const operations = require(`${__hooks}/lib/operations.js`)
  operations.validateCmsImageRequest(e, {
    field: 'cover_image',
    widthField: 'cover_width',
    heightField: 'cover_height',
    maxBytes: 5 * 1024 * 1024,
  })
  return e.next()
}, 'posts')

onRecordUpdateRequest((e) => {
  const operations = require(`${__hooks}/lib/operations.js`)
  operations.validateCmsImageRequest(e, {
    field: 'cover_image',
    widthField: 'cover_width',
    heightField: 'cover_height',
    maxBytes: 5 * 1024 * 1024,
  })
  return e.next()
}, 'posts')

onRecordCreateRequest((e) => {
  const operations = require(`${__hooks}/lib/operations.js`)
  operations.validateCmsImageRequest(e, {
    field: 'image',
    widthField: 'image_width',
    heightField: 'image_height',
    maxBytes: 10 * 1024 * 1024,
  })
  operations.assignGalleryOrder(e)
  operations.validateGalleryPublication(e.record)
  return e.next()
}, 'gallery_images')

onRecordUpdateRequest((e) => {
  const operations = require(`${__hooks}/lib/operations.js`)
  operations.validateCmsImageRequest(e, {
    field: 'image',
    widthField: 'image_width',
    heightField: 'image_height',
    maxBytes: 10 * 1024 * 1024,
  })
  operations.validateGalleryPublication(e.record)
  return e.next()
}, 'gallery_images')

onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/operations.js`).validateCmsImageRequest(e, {
    field: 'image',
    widthField: 'image_width',
    heightField: 'image_height',
    maxBytes: 10 * 1024 * 1024,
  })
  return e.next()
}, 'landing_cards')

onRecordUpdateRequest((e) => {
  const operations = require(`${__hooks}/lib/operations.js`)
  operations.validateCmsImageRequest(e, {
    field: 'portrait',
    widthField: 'portrait_width',
    heightField: 'portrait_height',
    maxBytes: 10 * 1024 * 1024,
  })
  operations.validateAboutPortrait(e.record)
  return e.next()
}, 'about_page')

onRecordValidate((e) => {
  require(`${__hooks}/lib/operations.js`).validateAssetOwner(e.record)
  return e.next()
}, 'content_assets')
