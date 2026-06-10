migrate((app) => {
  const adminRule = '@request.auth.collectionName = "admins"'

  const admins = new Collection({
    type: 'auth',
    name: 'admins',
    listRule: adminRule,
    viewRule: adminRule,
    createRule: null,
    updateRule: adminRule,
    deleteRule: adminRule,
    passwordAuth: {
      enabled: true,
      identityFields: ['email'],
    },
  })

  const posts = new Collection({
    type: 'base',
    name: 'posts',
    listRule: 'published = true || @request.auth.collectionName = "admins"',
    viewRule: 'published = true || @request.auth.collectionName = "admins"',
    createRule: adminRule,
    updateRule: adminRule,
    deleteRule: adminRule,
    fields: [
      { name: 'title', type: 'text', required: true, max: 160 },
      { name: 'slug', type: 'text', required: true, max: 180, presentable: true },
      { name: 'excerpt', type: 'text', max: 500 },
      { name: 'cover_image', type: 'file', maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
      { name: 'content_html', type: 'editor' },
      { name: 'content_json', type: 'json' },
      { name: 'published', type: 'bool' },
      { name: 'published_at', type: 'date' },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_posts_slug ON posts (slug)',
      'CREATE INDEX idx_posts_published_at ON posts (published_at)',
    ],
  })

  const gallery = new Collection({
    type: 'base',
    name: 'gallery_images',
    listRule: 'published = true || @request.auth.collectionName = "admins"',
    viewRule: 'published = true || @request.auth.collectionName = "admins"',
    createRule: adminRule,
    updateRule: adminRule,
    deleteRule: adminRule,
    fields: [
      { name: 'title', type: 'text', required: true, max: 160, presentable: true },
      { name: 'image', type: 'file', required: true, maxSelect: 1, maxSize: 10485760, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
      { name: 'alt_text', type: 'text', max: 220 },
      { name: 'caption', type: 'text', max: 500 },
      { name: 'sort_order', type: 'number' },
      { name: 'published', type: 'bool' },
    ],
    indexes: ['CREATE INDEX idx_gallery_sort_order ON gallery_images (sort_order)'],
  })

  app.save(admins)
  app.save(posts)
  app.save(gallery)
}, (app) => {
  for (const name of ['gallery_images', 'posts', 'admins']) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch {
      // Collection was already removed.
    }
  }
})
