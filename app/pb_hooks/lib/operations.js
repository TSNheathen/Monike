/// <reference path="../../pb_data/types.d.ts" />

const richText =
  typeof __hooks === 'string'
    ? require(`${__hooks}/lib/rich-text.js`)
    : require('./rich-text.js')
const imageValidation =
  typeof __hooks === 'string'
    ? require(`${__hooks}/lib/image-validation.js`)
    : require('./image-validation.js')

const CATEGORY_KEYS = ['cesty', 'vzpominky', 'kocicky-andy', 'proces-tvorby']
const ADMIN_COLLECTION = 'admins'

function requireAdmin(e) {
  if (!e.auth) throw new UnauthorizedError('Přihlášení je vyžadováno.')
  if (e.auth.collection().name !== ADMIN_COLLECTION) {
    throw new ForbiddenError('Tato operace je dostupná pouze vlastníkovi webu.')
  }
  return e.auth
}

function fieldError(field, message, code) {
  const data = {}
  data[field] = { code: code || 'validation', message }
  throw new ApiError(400, 'Zadaná data nejsou platná.', data)
}

function optionalRecordByData(app, collection, field, value) {
  try {
    return app.findFirstRecordByData(collection, field, value)
  } catch {
    return null
  }
}

function allRecordsByFilter(app, collection, filter, params) {
  const records = []
  const batchSize = 200
  let offset = 0
  while (true) {
    const batch = app.findRecordsByFilter(
      collection,
      filter,
      'id',
      batchSize,
      offset,
      params,
    )
    records.push(...batch)
    if (batch.length < batchSize) return records
    offset += batch.length
  }
}

function bodyFrom(e) {
  return e.requestInfo().body || {}
}

function forcedTestFailure(e, point) {
  return (
    $os.getenv('MONIKE_TEST_MODE') === 'true' &&
    e.request.header.get('X-Monike-Test-Failure') === point
  )
}

function assertExpectedUpdated(record, expectedUpdated) {
  if (typeof expectedUpdated !== 'string' || expectedUpdated === '') {
    fieldError(
      'expectedUpdated',
      'Pro bezpečné uložení chybí verze načteného obsahu.',
      'missing_expected_updated',
    )
  }
  if (record.getString('updated') !== expectedUpdated) {
    throw new ApiError(
      409,
      'Obsah byl mezitím změněn v jiné kartě. Načtěte aktuální verzi před dalším uložením.',
      { code: 'stale_write' },
    )
  }
}

function normalizeSlug(value) {
  const slug = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (
    slug.length < 1 ||
    slug.length > 180 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    fieldError(
      'slug',
      'Adresa smí obsahovat jen malá písmena bez diakritiky, číslice a pomlčky.',
      'invalid_slug',
    )
  }
  return slug
}

function normalizeCategories(value) {
  if (!Array.isArray(value)) {
    fieldError('categories', 'Vyberte alespoň jednu kategorii.', 'invalid_categories')
  }
  const unique = []
  for (const key of CATEGORY_KEYS) {
    if (value.includes(key) && !unique.includes(key)) unique.push(key)
  }
  if (
    unique.length < 1 ||
    unique.length > 4 ||
    value.some((key) => !CATEGORY_KEYS.includes(key))
  ) {
    fieldError('categories', 'Vyberte jednu až čtyři platné kategorie.', 'invalid_categories')
  }
  return unique
}

function validatePostInput(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title || title.length > 160) {
    fieldError('title', 'Název je povinný a smí mít nejvýše 160 znaků.')
  }
  const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : ''
  if (excerpt.length > 500) fieldError('excerpt', 'Perex smí mít nejvýše 500 znaků.')

  let validation
  try {
    validation = richText.validateDocument(body.content_json)
  } catch (error) {
    fieldError('content_json', error.message, error.code)
  }
  if (body.published === true && !validation.hasMeaningfulContent) {
    fieldError('content_json', 'Publikovaný článek musí mít neprázdný obsah.', 'empty_content')
  }

  return {
    title,
    excerpt,
    slug: normalizeSlug(body.slug),
    categories: normalizeCategories(body.categories),
    contentJson: body.content_json,
    validation,
    published: body.published === true,
  }
}

function publicPocketBaseUrl() {
  const configured = $os.getenv('MONIKE_PUBLIC_POCKETBASE_URL')
  if (configured) return configured.replace(/\/$/, '')
  if (['demo', 'production'].includes($os.getenv('APP_ENV'))) {
    throw new InternalServerError('PocketBase nemá nastavenou veřejnou API adresu.')
  }
  return 'http://127.0.0.1:8090'
}

function uploadedImage(e, field, maxBytes) {
  let multipartFile
  let header
  try {
    ;[multipartFile, header] = e.request.formFile(field)
  } catch {
    fieldError(field, 'Vyberte obrázek k nahrání.', 'missing_image')
  }

  let bytes
  try {
    bytes = toBytes(multipartFile)
  } finally {
    multipartFile?.close()
  }

  try {
    const metadata = imageValidation.validateImage(bytes, {
      filename: header.filename,
      mime: header.header.get('Content-Type'),
      maxBytes,
      maxDimension: 4096,
    })
    return {
      bytes,
      filename: header.filename,
      metadata,
    }
  } catch (error) {
    fieldError(field, error.message, error.code)
  }
}

function uploadedRecordImage(record, field, maxBytes) {
  const files = record.getUnsavedFiles(field)
  if (files.length !== 1) {
    fieldError(field, 'Vyberte právě jeden obrázek.', 'missing_image')
  }
  const file = files[0]
  let reader
  let bytes
  try {
    reader = file.reader.open()
    bytes = toBytes(reader)
  } finally {
    reader?.close()
  }
  try {
    const metadata = imageValidation.validateImage(bytes, {
      filename: file.originalName || file.name,
      maxBytes,
      maxDimension: 4096,
    })
    return {
      bytes,
      filename: file.originalName || file.name,
      metadata,
    }
  } catch (error) {
    fieldError(field, error.message, error.code)
  }
}

function verifyImageDecode(app, upload) {
  const token = $security.randomString(24)
  const originalKey = `__monike_validation/${token}.${upload.metadata.extension}`
  const validationKey = `__monike_validation/${token}-thumb.${upload.metadata.extension}`
  let filesystem
  try {
    filesystem = app.newFilesystem()
    filesystem.upload(upload.bytes, originalKey)
    filesystem.createThumb(originalKey, validationKey, '1x1')
  } catch {
    throw new ApiError(400, 'Obrázek je poškozený nebo jej nelze bezpečně dekódovat.', {
      image: { code: 'corrupt_image', message: 'Obrázek se nepodařilo načíst.' },
    })
  } finally {
    try {
      filesystem?.delete(validationKey)
    } catch {
      // Validation thumbnail may not have been created.
    }
    try {
      filesystem?.delete(originalKey)
    } catch {
      // Validation source may not have been uploaded.
    }
    filesystem?.close()
  }
}

function validateCmsImageRequest(e, specification) {
  const field = specification.field
  if (e.record.getUnsavedFiles(field).length === 0) return
  const upload = uploadedRecordImage(e.record, field, specification.maxBytes)
  verifyImageDecode(e.app, upload)
  e.record.set(specification.widthField, upload.metadata.width)
  e.record.set(specification.heightField, upload.metadata.height)
}

function validateGalleryPublication(record) {
  if (record.getBool('published') && record.getString('alt_text').trim() === '') {
    fieldError(
      'alt_text',
      'Publikovaný obrázek musí mít alternativní text.',
      'missing_alt_text',
    )
  }
}

function assignGalleryOrder(e) {
  let lastOrder = 0
  try {
    lastOrder = e.app
      .findFirstRecordByFilter('gallery_images', 'sort_order >= 0', '-sort_order')
      .getInt('sort_order')
  } catch {
    // The first gallery record starts at one.
  }
  e.record.set('sort_order', lastOrder + 1)
}

function validateAboutPortrait(record) {
  const hasPortrait =
    record.getUnsavedFiles('portrait').length > 0 || record.getString('portrait') !== ''
  if (hasPortrait && record.getString('portrait_alt').trim() === '') {
    fieldError(
      'portrait_alt',
      'Portrét musí mít alternativní text.',
      'missing_alt_text',
    )
  }
}

function validateAssetOwner(record) {
  const hasPost = record.getString('post') !== ''
  const hasAbout = record.getString('about_page') !== ''
  if (hasPost === hasAbout) {
    fieldError(
      'post',
      'Rich-text obrázek musí patřit právě jednomu článku nebo stránce O mně.',
      'invalid_asset_owner',
    )
  }
}

function loadOwnedAssets(app, assetIds, ownerField, ownerId) {
  const result = {}
  for (const id of assetIds) {
    let asset
    try {
      asset = app.findRecordById('content_assets', id)
    } catch {
      fieldError('content_json', 'Dokument odkazuje na neexistující obrázek.', 'invalid_asset')
    }
    if (asset.getString(ownerField) !== ownerId) {
      fieldError('content_json', 'Obrázek nepatří k upravovanému obsahu.', 'invalid_asset_owner')
    }
    result[id] = {
      id,
      filename: asset.getString('image'),
      width: asset.getInt('width'),
      height: asset.getInt('height'),
    }
  }
  return result
}

function serializeContent(contentJson, assets) {
  try {
    return richText.serializeDocument(contentJson, {
      assetBaseUrl: publicPocketBaseUrl(),
      resolveAsset: (id) => assets[id] || null,
    })
  } catch (error) {
    fieldError('content_json', error.message, error.code)
  }
}

function synchronizeAssets(app, ownerField, ownerId, activeIds) {
  const records = allRecordsByFilter(
    app,
    'content_assets',
    `${ownerField} = {:ownerId}`,
    { ownerId },
  )
  for (const asset of records) {
    const shouldBeActive = activeIds.includes(asset.id)
    if (asset.getBool('active') !== shouldBeActive) {
      asset.set('active', shouldBeActive)
      app.save(asset)
    }
  }
}

function assertSlugAvailable(app, postId, slug) {
  const current = optionalRecordByData(app, 'posts', 'slug', slug)
  if (current && current.id !== postId) {
    fieldError('slug', 'Tuto adresu už používá jiný článek.', 'slug_collision')
  }
  const alias = optionalRecordByData(app, 'post_slug_aliases', 'slug', slug)
  if (alias && alias.getString('post') !== postId) {
    fieldError('slug', 'Tato adresa patří do historie jiného článku.', 'slug_collision')
  }
  return alias
}

function responseForPost(record) {
  return {
    id: record.id,
    updated: record.getString('updated'),
    slug: record.getString('slug'),
    published: record.getBool('published'),
    published_at: record.getString('published_at'),
    content_html: record.getString('content_html'),
  }
}

function stageContentAsset(e) {
  requireAdmin(e)
  const body = bodyFrom(e)
  const parentType = body.parentType
  const parentId = typeof body.parentId === 'string' ? body.parentId : ''
  let parentField

  if (parentType === 'post') {
    e.app.findRecordById('posts', parentId)
    parentField = 'post'
  } else if (parentType === 'about') {
    const about = e.app.findRecordById('about_page', parentId)
    if (about.getString('key') !== 'main') {
      fieldError('parentId', 'Neplatný obsah stránky O mně.', 'invalid_parent')
    }
    parentField = 'about_page'
  } else {
    fieldError('parentType', 'Neplatný typ upravovaného obsahu.', 'invalid_parent')
  }

  const upload = uploadedImage(e, 'image', 10 * 1024 * 1024)
  verifyImageDecode(e.app, upload)
  const asset = new Record(e.app.findCollectionByNameOrId('content_assets'))
  asset.set('image', $filesystem.fileFromBytes(upload.bytes, upload.filename))
  asset.set(parentField, parentId)
  asset.set('active', false)
  asset.set('width', upload.metadata.width)
  asset.set('height', upload.metadata.height)

  try {
    e.app.save(asset)
  } catch (error) {
    if (!asset.isNew()) {
      try {
        e.app.delete(asset)
      } catch {
        // Keep the original safe error; cleanup cron remains a secondary guard.
      }
    }
    throw error
  }

  return e.json(201, {
    record: {
      id: asset.id,
      image: asset.getString('image'),
      width: asset.getInt('width'),
      height: asset.getInt('height'),
      active: false,
      parentType,
      parentId,
      created: asset.getString('created'),
    },
  })
}

function savePost(e) {
  requireAdmin(e)
  const body = bodyFrom(e)
  const input = validatePostInput(body)
  const failAfterParentSave = forcedTestFailure(e, 'post-after-parent-save')
  let saved

  e.app.runInTransaction((tx) => {
    const isNew = !body.id
    const record = isNew
      ? new Record(tx.findCollectionByNameOrId('posts'))
      : tx.findRecordById('posts', body.id)
    if (!isNew) assertExpectedUpdated(record, body.expectedUpdated)

    const oldSlug = record.getString('slug')
    const hadPublishedAt = record.getString('published_at') !== ''
    const reclaimedAlias = assertSlugAvailable(tx, record.id, input.slug)
    const assets = loadOwnedAssets(tx, input.validation.assetIds, 'post', record.id)
    const html = serializeContent(input.contentJson, assets)

    record.set('title', input.title)
    record.set('slug', input.slug)
    record.set('excerpt', input.excerpt)
    record.set('categories', input.categories)
    record.set('content_json', input.contentJson)
    record.set('content_html', html)
    record.set('published', input.published)
    if (input.published && !hadPublishedAt) record.set('published_at', new Date().toISOString())
    tx.save(record)
    if (failAfterParentSave) {
      throw new InternalServerError('Testovací selhání transakce článku.')
    }

    if (oldSlug && oldSlug !== input.slug && hadPublishedAt) {
      if (reclaimedAlias && reclaimedAlias.getString('post') === record.id) {
        tx.delete(reclaimedAlias)
      }
      const existingOldAlias = optionalRecordByData(tx, 'post_slug_aliases', 'slug', oldSlug)
      if (!existingOldAlias) {
        const alias = new Record(tx.findCollectionByNameOrId('post_slug_aliases'))
        alias.set('slug', oldSlug)
        alias.set('post', record.id)
        tx.save(alias)
      }
    }

    synchronizeAssets(tx, 'post', record.id, input.validation.assetIds)
    saved = responseForPost(record)
  })

  return e.json(200, { record: saved })
}

function deletePost(e) {
  requireAdmin(e)
  const id = e.request.pathValue('id')
  const body = bodyFrom(e)
  const failAfterDependents = forcedTestFailure(e, 'post-delete-after-dependents')

  e.app.runInTransaction((tx) => {
    const post = tx.findRecordById('posts', id)
    assertExpectedUpdated(post, body.expectedUpdated)

    const aliases = allRecordsByFilter(
      tx,
      'post_slug_aliases',
      'post = {:post}',
      { post: id },
    )
    const assets = allRecordsByFilter(
      tx,
      'content_assets',
      'post = {:post}',
      { post: id },
    )
    for (const alias of aliases) tx.delete(alias)
    for (const asset of assets) tx.delete(asset)
    if (failAfterDependents) {
      throw new InternalServerError('Testovací selhání transakce smazání článku.')
    }
    tx.delete(post)
  })

  return e.json(200, { deleted: true })
}

function saveAbout(e) {
  requireAdmin(e)
  const body = bodyFrom(e)
  const failAfterParentSave = forcedTestFailure(e, 'about-after-parent-save')
  let validation
  try {
    validation = richText.validateDocument(body.content_json)
  } catch (error) {
    fieldError('content_json', error.message, error.code)
  }
  let saved

  e.app.runInTransaction((tx) => {
    const about = tx.findFirstRecordByData('about_page', 'key', 'main')
    assertExpectedUpdated(about, body.expectedUpdated)
    const assets = loadOwnedAssets(tx, validation.assetIds, 'about_page', about.id)
    const html = serializeContent(body.content_json, assets)
    about.set('content_json', body.content_json)
    about.set('content_html', html)
    tx.save(about)
    if (failAfterParentSave) {
      throw new InternalServerError('Testovací selhání transakce stránky O mně.')
    }
    synchronizeAssets(tx, 'about_page', about.id, validation.assetIds)
    saved = { id: about.id, updated: about.getString('updated'), content_html: html }
  })

  return e.json(200, { record: saved })
}

function reorderGallery(e) {
  requireAdmin(e)
  const body = bodyFrom(e)
  const failAfterFirstSave = forcedTestFailure(e, 'gallery-after-first-save')
  if (!Array.isArray(body.ids) || new Set(body.ids).size !== body.ids.length) {
    fieldError('ids', 'Pořadí galerie není platné.', 'invalid_order')
  }

  e.app.runInTransaction((tx) => {
    const records = tx.findAllRecords('gallery_images')
    if (records.length !== body.ids.length) {
      fieldError('ids', 'Pořadí musí obsahovat všechny položky galerie.', 'invalid_order')
    }
    const byId = {}
    for (const record of records) byId[record.id] = record
    for (let index = 0; index < body.ids.length; index += 1) {
      const record = byId[body.ids[index]]
      if (!record) fieldError('ids', 'Pořadí obsahuje neznámou položku.', 'invalid_order')
      record.set('sort_order', index + 1)
      tx.save(record)
      if (failAfterFirstSave && index === 0) {
        throw new InternalServerError('Testovací selhání transakce pořadí galerie.')
      }
    }
  })

  return e.json(200, { ordered: true })
}

function resolveArticle(e) {
  const slug = e.request.pathValue('slug')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) {
    throw new NotFoundError('Článek nebyl nalezen.')
  }

  const current = optionalRecordByData(e.app, 'posts', 'slug', slug)
  if (
    current &&
    current.getBool('published') &&
    current.getStringSlice('categories').length > 0
  ) {
    return e.json(200, { kind: 'canonical', record: current.publicExport() })
  }

  const alias = optionalRecordByData(e.app, 'post_slug_aliases', 'slug', slug)
  if (alias) {
    const post = e.app.findRecordById('posts', alias.getString('post'))
    if (post.getBool('published') && post.getStringSlice('categories').length > 0) {
      return e.json(200, {
        kind: 'alias',
        location: `/blog/${post.getString('slug')}`,
      })
    }
  }

  throw new NotFoundError('Článek nebyl nalezen.')
}

function containsAssetReference(value, assetId) {
  if (!value || typeof value !== 'object') return false
  if (value.assetId === assetId) return true
  if (Array.isArray(value)) {
    return value.some((item) => containsAssetReference(item, assetId))
  }
  return Object.keys(value).some((key) => containsAssetReference(value[key], assetId))
}

function parentStillReferencesAsset(app, asset) {
  const postId = asset.getString('post')
  const aboutId = asset.getString('about_page')
  try {
    const parent = postId
      ? app.findRecordById('posts', postId)
      : app.findRecordById('about_page', aboutId)
    return containsAssetReference(parent.getRaw('content_json'), asset.id)
  } catch {
    return false
  }
}

function cleanupInactiveAssets(app, now) {
  const startedAt = Date.now()
  const cutoffTime = (now || Date.now()) - 7 * 24 * 60 * 60 * 1000
  const cutoff = new Date(cutoffTime).toISOString()
  const candidates = app.findRecordsByFilter(
    'content_assets',
    'active = false && created < {:cutoff}',
    'created',
    500,
    0,
    { cutoff },
  )
  let deleted = 0
  for (const candidate of candidates) {
    const fresh = app.findRecordById('content_assets', candidate.id)
    if (
      !fresh.getBool('active') &&
      new Date(fresh.getString('created')).getTime() < cutoffTime &&
      !parentStillReferencesAsset(app, fresh)
    ) {
      app.delete(fresh)
      deleted += 1
    }
  }
  return { candidates: candidates.length, deleted, durationMs: Date.now() - startedAt }
}

module.exports = {
  assignGalleryOrder,
  cleanupInactiveAssets,
  deletePost,
  reorderGallery,
  resolveArticle,
  saveAbout,
  savePost,
  stageContentAsset,
  validateAboutPortrait,
  validateAssetOwner,
  validateCmsImageRequest,
  validateGalleryPublication,
}
