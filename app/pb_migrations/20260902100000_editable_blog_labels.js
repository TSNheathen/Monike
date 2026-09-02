/// <reference path="../pb_data/types.d.ts" />

const ADMIN_RULE = '@request.auth.collectionName = "admins"'
const PUBLIC_POST_RULE =
  '(published = true && labels:length > 0) || @request.auth.collectionName = "admins"'
const LEGACY_CATEGORIES = [
  { name: 'Cesty & příběhy', slug: 'cesty', color: '#B88A36', sortOrder: 10 },
  { name: 'Vzpomínky', slug: 'vzpominky', color: '#9D6B53', sortOrder: 20 },
  { name: 'Kočičky & Andy', slug: 'kocicky-andy', color: '#7D8C72', sortOrder: 30 },
  { name: 'Proces tvorby', slug: 'proces-tvorby', color: '#806B9B', sortOrder: 40 },
]

function timestampFields() {
  return [
    new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
    new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
  ]
}

migrate((app) => {
  const labels = new Collection({
    type: 'base',
    name: 'blog_labels',
    listRule: '',
    viewRule: '',
    createRule: ADMIN_RULE,
    updateRule: ADMIN_RULE,
    deleteRule: ADMIN_RULE,
    indexes: [
      'CREATE UNIQUE INDEX idx_blog_labels_slug ON blog_labels (slug)',
      'CREATE INDEX idx_blog_labels_order ON blog_labels (sort_order, name)',
    ],
  })
  labels.fields.add(
    new TextField({ name: 'name', required: true, max: 80, presentable: true }),
    new TextField({
      name: 'slug',
      required: true,
      max: 80,
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    }),
    new TextField({
      name: 'color',
      required: true,
      max: 7,
      pattern: '^#[0-9A-Fa-f]{6}$',
    }),
    new NumberField({ name: 'sort_order', onlyInt: true, min: 0 }),
    ...timestampFields(),
  )
  app.save(labels)

  const labelIds = {}
  for (const seed of LEGACY_CATEGORIES) {
    const record = new Record(labels)
    record.load({
      name: seed.name,
      slug: seed.slug,
      color: seed.color,
      sort_order: seed.sortOrder,
    })
    app.save(record)
    labelIds[seed.slug] = record.id
  }

  const posts = app.findCollectionByNameOrId('posts')
  posts.fields.getByName('categories').required = false
  posts.fields.add(new RelationField({
    name: 'labels',
    collectionId: labels.id,
    minSelect: 1,
    maxSelect: 100,
  }))
  app.save(posts)

  for (const post of app.findAllRecords('posts')) {
    const migrated = post
      .getStringSlice('categories')
      .map((slug) => labelIds[slug])
      .filter(Boolean)
    post.set('labels', migrated)
    app.save(post)
  }

  const landingCards = app.findCollectionByNameOrId('landing_cards')
  landingCards.fields.add(new RelationField({
    name: 'label',
    collectionId: labels.id,
    maxSelect: 1,
  }))
  app.save(landingCards)
  for (const card of app.findAllRecords('landing_cards')) {
    const labelId = labelIds[card.getString('slot')]
    if (labelId) {
      card.set('label', labelId)
      app.save(card)
    }
  }

  posts.fields.getByName('labels').required = true
  posts.fields.removeByName('categories')
  posts.listRule = PUBLIC_POST_RULE
  posts.viewRule = PUBLIC_POST_RULE
  posts.updateRule =
    ADMIN_RULE +
    ' && @request.body.title:isset = false' +
    ' && @request.body.slug:isset = false' +
    ' && @request.body.excerpt:isset = false' +
    ' && @request.body.labels:isset = false' +
    ' && @request.body.content_json:isset = false' +
    ' && @request.body.content_html:isset = false' +
    ' && @request.body.published:isset = false' +
    ' && @request.body.published_at:isset = false' +
    ' && @request.body.cover_width:isset = false' +
    ' && @request.body.cover_height:isset = false'
  app.save(posts)

  const aliases = app.findCollectionByNameOrId('post_slug_aliases')
  aliases.listRule =
    '(post.published = true && post.labels:length > 0) || @request.auth.collectionName = "admins"'
  aliases.viewRule = aliases.listRule
  app.save(aliases)

  const assets = app.findCollectionByNameOrId('content_assets')
  assets.listRule =
    '@request.auth.collectionName = "admins" || (active = true && ((post != "" && post.published = true && post.labels:length > 0) || (about_page != "" && about_page.key = "main")))'
  assets.viewRule = assets.listRule
  app.save(assets)
}, (app) => {
  const posts = app.findCollectionByNameOrId('posts')
  const labels = app.findCollectionByNameOrId('blog_labels')
  posts.fields.add(new SelectField({
    name: 'categories',
    values: LEGACY_CATEGORIES.map((item) => item.slug),
    maxSelect: 4,
    required: false,
  }))
  app.save(posts)

  for (const post of app.findAllRecords('posts')) {
    const categories = post
      .getStringSlice('labels')
      .map((id) => {
        try {
          return app.findRecordById(labels.id, id).getString('slug')
        } catch {
          return ''
        }
      })
      .filter((slug) => LEGACY_CATEGORIES.some((item) => item.slug === slug))
    post.set('categories', categories)
    app.save(post)
  }

  posts.fields.getByName('categories').required = true
  posts.fields.removeByName('labels')
  posts.listRule =
    '(published = true && categories:length > 0) || @request.auth.collectionName = "admins"'
  posts.viewRule = posts.listRule
  posts.updateRule = posts.updateRule.replace(
    '@request.body.labels:isset = false',
    '@request.body.categories:isset = false',
  )
  app.save(posts)

  const landingCards = app.findCollectionByNameOrId('landing_cards')
  landingCards.fields.removeByName('label')
  app.save(landingCards)

  const aliases = app.findCollectionByNameOrId('post_slug_aliases')
  aliases.listRule =
    '(post.published = true && post.categories:length > 0) || @request.auth.collectionName = "admins"'
  aliases.viewRule = aliases.listRule
  app.save(aliases)

  const assets = app.findCollectionByNameOrId('content_assets')
  assets.listRule =
    '@request.auth.collectionName = "admins" || (active = true && ((post != "" && post.published = true && post.categories:length > 0) || (about_page != "" && about_page.key = "main")))'
  assets.viewRule = assets.listRule
  app.save(assets)

  app.delete(labels)
})
