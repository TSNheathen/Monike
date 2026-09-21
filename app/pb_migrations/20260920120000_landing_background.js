/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const site = app.findCollectionByNameOrId('site_content')
  site.fields.add(
    new FileField({
      name: 'landing_background',
      maxSelect: 1,
      maxSize: 10485760,
      mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      protected: true,
      thumbs: ['800x0', '1200x0', '1600x0', '2400x0'],
    }),
    new NumberField({ name: 'background_width', min: 0, max: 4096, onlyInt: true }),
    new NumberField({ name: 'background_height', min: 0, max: 4096, onlyInt: true }),
  )
  site.updateRule +=
    ' && (@request.body.key:isset = false || @request.body.key = key)' +
    ' && @request.body.background_width:isset = false' +
    ' && @request.body.background_height:isset = false'
  app.save(site)
})
