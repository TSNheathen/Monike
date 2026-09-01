/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const aliases = app.findCollectionByNameOrId('post_slug_aliases')
  aliases.listRule =
    '(post.published = true && post.categories:length > 0) || @request.auth.collectionName = "admins"'
  aliases.viewRule = aliases.listRule
  app.save(aliases)

  const contentAssets = app.findCollectionByNameOrId('content_assets')
  contentAssets.listRule =
    '@request.auth.collectionName = "admins" || (active = true && ((post != "" && post.published = true && post.categories:length > 0) || (about_page != "" && about_page.key = "main")))'
  contentAssets.viewRule = contentAssets.listRule
  app.save(contentAssets)

  const immutableMainRule =
    '@request.auth.collectionName = "admins" && (@request.body.key:isset = false || @request.body.key = key)'
  for (const name of ['site_content', 'about_page']) {
    const collection = app.findCollectionByNameOrId(name)
    collection.updateRule = immutableMainRule
    app.save(collection)
  }

  const landingCards = app.findCollectionByNameOrId('landing_cards')
  landingCards.updateRule =
    '@request.auth.collectionName = "admins" && (@request.body.slot:isset = false || @request.body.slot = slot)'
  app.save(landingCards)
}, (app) => {
  const adminRule = '@request.auth.collectionName = "admins"'

  for (const name of ['post_slug_aliases', 'content_assets']) {
    const collection = app.findCollectionByNameOrId(name)
    collection.listRule = adminRule
    collection.viewRule = adminRule
    app.save(collection)
  }

  for (const name of ['site_content', 'about_page', 'landing_cards']) {
    const collection = app.findCollectionByNameOrId(name)
    collection.updateRule = adminRule
    app.save(collection)
  }
})
