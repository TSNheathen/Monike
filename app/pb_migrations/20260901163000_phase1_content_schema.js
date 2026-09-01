/// <reference path="../pb_data/types.d.ts" />

const ADMIN_RULE = '@request.auth.collectionName = "admins"'
const PUBLIC_POST_RULE =
  '(published = true && categories:length > 0) || @request.auth.collectionName = "admins"'
const CONTENT_ASSET_READ_RULE =
  '@request.auth.collectionName = "admins" || ' +
  '(active = true && (post.published = true || about_page.key = "main"))'
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const CATEGORY_KEYS = ['cesty', 'vzpominky', 'kocicky-andy', 'proces-tvorby']

function timestampFields() {
  return [
    new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
    new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
  ]
}

function dimensionFields(widthName, heightName) {
  return [
    new NumberField({ name: widthName, min: 0, max: 4096, onlyInt: true }),
    new NumberField({ name: heightName, min: 0, max: 4096, onlyInt: true }),
  ]
}

function seedRecord(app, collection, values) {
  const record = new Record(collection)
  record.load(values)
  app.save(record)
  return record
}

migrate((app) => {
  const admins = app.findCollectionByNameOrId('admins')
  admins.listRule = null
  admins.viewRule = null
  admins.createRule = null
  admins.updateRule = null
  admins.deleteRule = null
  admins.authToken.duration = 28800
  admins.fields.getByName('password').min = 16
  app.save(admins)

  const posts = app.findCollectionByNameOrId('posts')
  posts.listRule = PUBLIC_POST_RULE
  posts.viewRule = PUBLIC_POST_RULE
  posts.fields.add(
    new SelectField({
      name: 'categories',
      values: CATEGORY_KEYS,
      maxSelect: 4,
      required: true,
    }),
    ...dimensionFields('cover_width', 'cover_height'),
    ...timestampFields(),
  )
  const coverImage = posts.fields.getByName('cover_image')
  coverImage.protected = true
  coverImage.mimeTypes = IMAGE_MIME_TYPES
  coverImage.maxSize = 5242880
  coverImage.thumbs = [
    '480x0',
    '800x0',
    '1200x0',
    '1600x0',
    '2400x0',
    '1200x630',
  ]
  posts.indexes = [
    'CREATE UNIQUE INDEX idx_posts_slug ON posts (slug)',
    'CREATE INDEX idx_posts_published_at ON posts (published_at)',
    'CREATE INDEX idx_posts_public_listing ON posts (published, published_at DESC, created DESC)',
  ]
  app.save(posts)

  const gallery = app.findCollectionByNameOrId('gallery_images')
  gallery.fields.add(
    ...dimensionFields('image_width', 'image_height'),
    ...timestampFields(),
  )
  const galleryImage = gallery.fields.getByName('image')
  galleryImage.protected = true
  galleryImage.mimeTypes = IMAGE_MIME_TYPES
  galleryImage.maxSize = 10485760
  galleryImage.thumbs = [
    '480x600',
    '800x1000',
    '1200x0',
    '1600x0',
    '2400x0',
  ]
  gallery.fields.getByName('sort_order').onlyInt = true
  gallery.fields.getByName('sort_order').min = 0
  gallery.indexes = [
    'CREATE INDEX idx_gallery_sort_order ON gallery_images (sort_order)',
    'CREATE INDEX idx_gallery_public_order ON gallery_images (published, sort_order, created)',
  ]
  app.save(gallery)

  const aliases = new Collection({
    type: 'base',
    name: 'post_slug_aliases',
    listRule: ADMIN_RULE,
    viewRule: ADMIN_RULE,
    createRule: ADMIN_RULE,
    updateRule: ADMIN_RULE,
    deleteRule: ADMIN_RULE,
    indexes: [
      'CREATE UNIQUE INDEX idx_post_slug_aliases_slug ON post_slug_aliases (slug)',
      'CREATE INDEX idx_post_slug_aliases_post ON post_slug_aliases (post)',
    ],
  })
  aliases.fields.add(
    new TextField({ name: 'slug', required: true, max: 180, presentable: true }),
    new RelationField({
      name: 'post',
      required: true,
      maxSelect: 1,
      collectionId: posts.id,
      cascadeDelete: true,
    }),
    ...timestampFields(),
  )
  app.save(aliases)

  const siteContent = new Collection({
    type: 'base',
    name: 'site_content',
    listRule: '',
    viewRule: '',
    createRule: null,
    updateRule: ADMIN_RULE,
    deleteRule: null,
    indexes: ['CREATE UNIQUE INDEX idx_site_content_key ON site_content (`key`)'],
  })
  siteContent.fields.add(
    new TextField({ name: 'key', required: true, max: 40, presentable: true }),
    new TextField({ name: 'hero_subtitle', required: true, max: 160 }),
    new TextField({ name: 'hero_body', required: true, max: 1200 }),
    new TextField({ name: 'hero_cta_label', required: true, max: 80 }),
    new TextField({ name: 'signature_text', max: 160 }),
    new TextField({ name: 'contact_intro', required: true, max: 1000 }),
    new EmailField({ name: 'contact_email', required: true }),
    new URLField({ name: 'instagram_url', required: true }),
    new URLField({ name: 'facebook_url', required: true }),
    ...timestampFields(),
  )
  app.save(siteContent)

  const landingCards = new Collection({
    type: 'base',
    name: 'landing_cards',
    listRule: '',
    viewRule: '',
    createRule: null,
    updateRule: ADMIN_RULE,
    deleteRule: null,
    indexes: ['CREATE UNIQUE INDEX idx_landing_cards_slot ON landing_cards (slot)'],
  })
  landingCards.fields.add(
    new TextField({ name: 'slot', required: true, max: 40, presentable: true }),
    new TextField({ name: 'title', required: true, max: 100 }),
    new TextField({ name: 'description', required: true, max: 500 }),
    new FileField({
      name: 'image',
      required: true,
      maxSelect: 1,
      maxSize: 10485760,
      mimeTypes: IMAGE_MIME_TYPES,
      protected: true,
      thumbs: ['480x0', '800x0'],
    }),
    ...dimensionFields('image_width', 'image_height'),
    ...timestampFields(),
  )
  app.save(landingCards)

  const aboutPage = new Collection({
    type: 'base',
    name: 'about_page',
    listRule: '',
    viewRule: '',
    createRule: null,
    updateRule: ADMIN_RULE,
    deleteRule: null,
    indexes: ['CREATE UNIQUE INDEX idx_about_page_key ON about_page (`key`)'],
  })
  aboutPage.fields.add(
    new TextField({ name: 'key', required: true, max: 40, presentable: true }),
    new FileField({
      name: 'portrait',
      maxSelect: 1,
      maxSize: 10485760,
      mimeTypes: IMAGE_MIME_TYPES,
      protected: true,
      thumbs: ['480x0', '800x0', '1200x0', '1600x0'],
    }),
    new TextField({ name: 'portrait_alt', max: 220 }),
    new JSONField({ name: 'content_json', required: true }),
    new EditorField({ name: 'content_html' }),
    ...dimensionFields('portrait_width', 'portrait_height'),
    ...timestampFields(),
  )
  app.save(aboutPage)

  const contentAssets = new Collection({
    type: 'base',
    name: 'content_assets',
    listRule: CONTENT_ASSET_READ_RULE,
    viewRule: CONTENT_ASSET_READ_RULE,
    createRule: ADMIN_RULE,
    updateRule: ADMIN_RULE,
    deleteRule: ADMIN_RULE,
    indexes: [
      'CREATE INDEX idx_content_assets_post_active ON content_assets (post, active, created)',
      'CREATE INDEX idx_content_assets_about_active ON content_assets (about_page, active, created)',
    ],
  })
  contentAssets.fields.add(
    new FileField({
      name: 'image',
      required: true,
      maxSelect: 1,
      maxSize: 10485760,
      mimeTypes: IMAGE_MIME_TYPES,
      protected: true,
      thumbs: ['480x0', '800x0', '1200x0', '1600x0'],
    }),
    new RelationField({
      name: 'post',
      maxSelect: 1,
      collectionId: posts.id,
      cascadeDelete: true,
    }),
    new RelationField({
      name: 'about_page',
      maxSelect: 1,
      collectionId: aboutPage.id,
      cascadeDelete: true,
    }),
    new BoolField({ name: 'active' }),
    ...dimensionFields('width', 'height'),
    ...timestampFields(),
  )
  app.save(contentAssets)

  seedRecord(app, siteContent, {
    key: 'main',
    hero_subtitle: 'Tvořím. Cestuji. Žiju.',
    hero_body:
      'Umění je můj jazyk.\nCestování moje inspirace.\nOkamžiky moje vzpomínky.\nTady sdílím vše, co tvoří můj svět.',
    hero_cta_label: 'VSTOUPIT DO MÉHO SVĚTA',
    signature_text: 'Collect moments, not things',
    contact_intro: 'Napiš mi e-mailem nebo přes sociální sítě.',
    contact_email: 'monike@example.com',
    instagram_url: 'https://www.instagram.com/',
    facebook_url: 'https://www.facebook.com/',
  })

  const seedCards = [
    {
      slot: 'gallery',
      title: 'GALERIE',
      description: 'Obrazy, kresby, portréty, ilustrace a další tvorba',
      image: 'card-galerie.png',
    },
    {
      slot: 'cesty',
      title: 'CESTY & PŘÍBĚHY',
      description: 'Zážitky, příběhy a fotografie z celého světa',
      image: 'card-cesty-pribehy.png',
    },
    {
      slot: 'vzpominky',
      title: 'VZPOMÍNKY',
      description: 'Nezapomenutelné okamžiky, které si nesu srdcem',
      image: 'card-vzpominky.png',
    },
    {
      slot: 'kocicky-andy',
      title: 'KOČIČKY & ANDY',
      description: 'Moje chlupaté parťačky a můj papoušek Andy',
      image: 'card-kocicky-andy.png',
    },
    {
      slot: 'proces-tvorby',
      title: 'PROCES TVORBY',
      description: 'Jak vznikají má díla, inspirace, myšlenky a zákulisí tvorby',
      image: 'card-proces-tvorby.png',
    },
  ]
  const seedAssetRoot = __hooks + '/../public/assets/landing/'
  for (const card of seedCards) {
    const record = new Record(landingCards)
    record.load({
      slot: card.slot,
      title: card.title,
      description: card.description,
      image_width: 1024,
      image_height: 1536,
    })
    record.set('image', $filesystem.fileFromPath(seedAssetRoot + card.image))
    app.save(record)
  }

  seedRecord(app, aboutPage, {
    key: 'main',
    portrait_alt: '',
    content_json: { type: 'doc', content: [{ type: 'paragraph' }] },
    content_html: '<p></p>',
  })
}, (app) => {
  for (const name of [
    'content_assets',
    'about_page',
    'landing_cards',
    'site_content',
    'post_slug_aliases',
  ]) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch {
      // The collection has already been removed.
    }
  }

  const posts = app.findCollectionByNameOrId('posts')
  for (const field of [
    'categories',
    'cover_width',
    'cover_height',
    'created',
    'updated',
  ]) {
    posts.fields.removeByName(field)
  }
  const coverImage = posts.fields.getByName('cover_image')
  coverImage.protected = false
  coverImage.thumbs = []
  posts.listRule = 'published = true || @request.auth.collectionName = "admins"'
  posts.viewRule = posts.listRule
  posts.indexes = [
    'CREATE UNIQUE INDEX idx_posts_slug ON posts (slug)',
    'CREATE INDEX idx_posts_published_at ON posts (published_at)',
  ]
  app.save(posts)

  const gallery = app.findCollectionByNameOrId('gallery_images')
  for (const field of ['image_width', 'image_height', 'created', 'updated']) {
    gallery.fields.removeByName(field)
  }
  const galleryImage = gallery.fields.getByName('image')
  galleryImage.protected = false
  galleryImage.thumbs = []
  gallery.fields.getByName('sort_order').onlyInt = false
  gallery.fields.getByName('sort_order').min = null
  gallery.indexes = [
    'CREATE INDEX idx_gallery_sort_order ON gallery_images (sort_order)',
  ]
  app.save(gallery)

  const admins = app.findCollectionByNameOrId('admins')
  admins.listRule = ADMIN_RULE
  admins.viewRule = ADMIN_RULE
  admins.updateRule = ADMIN_RULE
  admins.deleteRule = ADMIN_RULE
  admins.authToken.duration = 432000
  admins.fields.getByName('password').min = 8
  app.save(admins)
})
