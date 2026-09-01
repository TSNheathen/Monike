/// <reference path="../pb_data/types.d.ts" />

const ADMIN_RULE = '@request.auth.collectionName = "admins"'

migrate((app) => {
  // Alias history and inline-asset lifecycle are mutated only by the narrow
  // transactional application routes. Normal record CRUD remains read-only.
  for (const name of ['post_slug_aliases', 'content_assets']) {
    const collection = app.findCollectionByNameOrId(name)
    collection.createRule = null
    collection.updateRule = null
    collection.deleteRule = null
    app.save(collection)
  }

  // Article content/publication/history is owned by the post transaction.
  // Ordinary record update remains only for the independent cover workflow.
  const posts = app.findCollectionByNameOrId('posts')
  posts.createRule = null
  posts.deleteRule = null
  posts.updateRule =
    ADMIN_RULE +
    ' && @request.body.title:isset = false' +
    ' && @request.body.slug:isset = false' +
    ' && @request.body.excerpt:isset = false' +
    ' && @request.body.categories:isset = false' +
    ' && @request.body.content_json:isset = false' +
    ' && @request.body.content_html:isset = false' +
    ' && @request.body.published:isset = false' +
    ' && @request.body.published_at:isset = false' +
    ' && @request.body.cover_width:isset = false' +
    ' && @request.body.cover_height:isset = false'
  app.save(posts)

  const gallery = app.findCollectionByNameOrId('gallery_images')
  gallery.updateRule =
    ADMIN_RULE +
    ' && @request.body.sort_order:isset = false' +
    ' && @request.body.image_width:isset = false' +
    ' && @request.body.image_height:isset = false'
  app.save(gallery)

  // Rich-text fields use the transactional About operation. Ordinary updates
  // remain available for the independently saved portrait workflow.
  const about = app.findCollectionByNameOrId('about_page')
  about.updateRule =
    ADMIN_RULE +
    ' && (@request.body.key:isset = false || @request.body.key = key)' +
    ' && @request.body.content_json:isset = false' +
    ' && @request.body.content_html:isset = false' +
    ' && @request.body.portrait_width:isset = false' +
    ' && @request.body.portrait_height:isset = false'
  app.save(about)

  const landingCards = app.findCollectionByNameOrId('landing_cards')
  landingCards.updateRule =
    ADMIN_RULE +
    ' && (@request.body.slot:isset = false || @request.body.slot = slot)' +
    ' && @request.body.image_width:isset = false' +
    ' && @request.body.image_height:isset = false'
  app.save(landingCards)
}, (app) => {
  const aliases = app.findCollectionByNameOrId('post_slug_aliases')
  aliases.createRule = ADMIN_RULE
  aliases.updateRule = ADMIN_RULE
  aliases.deleteRule = ADMIN_RULE
  app.save(aliases)

  const assets = app.findCollectionByNameOrId('content_assets')
  assets.createRule = ADMIN_RULE
  assets.updateRule = ADMIN_RULE
  assets.deleteRule = ADMIN_RULE
  app.save(assets)

  const posts = app.findCollectionByNameOrId('posts')
  posts.createRule = ADMIN_RULE
  posts.updateRule = ADMIN_RULE
  posts.deleteRule = ADMIN_RULE
  app.save(posts)

  const gallery = app.findCollectionByNameOrId('gallery_images')
  gallery.updateRule = ADMIN_RULE
  app.save(gallery)

  const about = app.findCollectionByNameOrId('about_page')
  about.updateRule =
    ADMIN_RULE +
    ' && (@request.body.key:isset = false || @request.body.key = key)'
  app.save(about)

  const landingCards = app.findCollectionByNameOrId('landing_cards')
  landingCards.updateRule =
    ADMIN_RULE +
    ' && (@request.body.slot:isset = false || @request.body.slot = slot)'
  app.save(landingCards)
})
