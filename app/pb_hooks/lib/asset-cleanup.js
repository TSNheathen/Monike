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

module.exports = { cleanupInactiveAssets }
