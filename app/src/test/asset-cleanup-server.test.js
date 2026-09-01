import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { cleanupInactiveAssets } = require('../../pb_hooks/lib/operations.js')

function record({ id, active = false, created, post = 'parent-post' }) {
  return {
    id,
    getBool: (field) => (field === 'active' ? active : false),
    getString: (field) => ({ created, post, about_page: '' })[field] || '',
  }
}

describe('úklid neaktivních rich-text assetů', () => {
  it('po sedmi dnech smaže jen stále neaktivní a nereferencované položky', () => {
    const oldUnused = record({ id: 'old-unused', created: '2026-08-20 12:00:00.000Z' })
    const oldActive = record({
      id: 'old-active',
      active: true,
      created: '2026-08-20 12:00:00.000Z',
    })
    const oldReferenced = record({
      id: 'old-referenced',
      created: '2026-08-20 12:00:00.000Z',
    })
    const recent = record({ id: 'recent', created: '2026-08-31 12:00:00.000Z' })
    const byId = Object.fromEntries(
      [oldUnused, oldActive, oldReferenced, recent].map((item) => [item.id, item]),
    )
    const deleted = []
    const app = {
      findRecordsByFilter: () => Object.values(byId),
      findRecordById: (collection, id) => {
        if (collection === 'content_assets') return byId[id]
        return {
          getRaw: () => ({
            type: 'doc',
            content:
              id === 'parent-post'
                ? [{ type: 'monikeImage', attrs: { assetId: 'old-referenced' } }]
                : [],
          }),
        }
      },
      delete: (item) => deleted.push(item.id),
    }

    cleanupInactiveAssets(app, new Date('2026-09-01T15:00:00.000Z').getTime())
    expect(deleted).toEqual(['old-unused'])
  })
})
