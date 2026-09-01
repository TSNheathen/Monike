import PocketBase from 'pocketbase'
import { POCKETBASE_URL } from '../config/environment.js'
import { SessionAuthStore } from './auth.js'
import { API_ERROR_KINDS, configurationError, normalizeApiError } from './api-errors.js'
import { publishedPostsFilter } from './queries.js'

export const pb = new PocketBase(POCKETBASE_URL, new SessionAuthStore())

export function fileUrl(record, field, options) {
  const value = record?.[field]
  if (!record || !value) return ''
  return pb.files.getURL(record, value, options)
}

async function list(collection, options) {
  try {
    return await pb.collection(collection).getFullList(options)
  } catch (error) {
    throw normalizeApiError(error, `Kolekci ${collection} se nepodařilo načíst.`)
  }
}

async function send(path, options) {
  try {
    return await pb.send(path, options)
  } catch (error) {
    throw normalizeApiError(error)
  }
}

async function createRecord(collection, data) {
  try {
    return await pb.collection(collection).create(data)
  } catch (error) {
    throw normalizeApiError(error, `Záznam v kolekci ${collection} se nepodařilo vytvořit.`)
  }
}

async function updateRecord(collection, id, data) {
  try {
    return await pb.collection(collection).update(id, data)
  } catch (error) {
    throw normalizeApiError(error, `Záznam v kolekci ${collection} se nepodařilo upravit.`)
  }
}

async function deleteRecord(collection, id) {
  try {
    return await pb.collection(collection).delete(id)
  } catch (error) {
    throw normalizeApiError(error, `Záznam v kolekci ${collection} se nepodařilo smazat.`)
  }
}

export const api = {
  isAdmin() {
    return pb.authStore.isValid
  },
  ownerEmail() {
    return pb.authStore.record?.email || ''
  },
  async login(email, password) {
    try {
      return await pb.collection('admins').authWithPassword(email, password)
    } catch (error) {
      throw normalizeApiError(error, 'Přihlášení se nezdařilo.')
    }
  },
  async reauthenticate(email, password) {
    try {
      return await pb.collection('admins').authWithPassword(email, password)
    } catch (error) {
      throw normalizeApiError(error, 'Opětovné přihlášení se nezdařilo.')
    }
  },
  logout() {
    pb.authStore.clear()
  },
  async posts(publishedOnly = true, categoryKey = null) {
    return list('posts', {
      sort: '-published_at,-created',
      filter: publishedOnly ? publishedPostsFilter(pb, categoryKey) : undefined,
    })
  },
  async postBySlug(slug) {
    const result = await send(`/api/monike/articles/${encodeURIComponent(slug)}`, {
      method: 'GET',
    })
    return result
  },
  async postById(id) {
    try {
      return await pb.collection('posts').getOne(id)
    } catch (error) {
      throw normalizeApiError(error, 'Článek se nepodařilo načíst.')
    }
  },
  async protectedFileUrl(record, field, thumb = '') {
    if (!record?.[field]) return ''
    try {
      const token = await pb.files.getToken()
      return fileUrl(record, field, { token, ...(thumb ? { thumb } : {}) })
    } catch (error) {
      throw normalizeApiError(error, 'Náhled souboru se nepodařilo zpřístupnit.')
    }
  },
  async postAliases(postId) {
    return list('post_slug_aliases', {
      sort: '-created',
      filter: pb.filter('post = {:postId}', { postId }),
    })
  },
  async contentAssets(parentType, parentId) {
    const field = parentType === 'post' ? 'post' : 'about_page'
    const records = await list('content_assets', {
      sort: 'created',
      filter: pb.filter(`${field} = {:parentId}`, { parentId }),
    })
    let token = ''
    if (records.length) {
      try {
        token = await pb.files.getToken()
      } catch (error) {
        throw normalizeApiError(error, 'Náhledy obrázků se nepodařilo zpřístupnit.')
      }
    }
    return records.map((record) => ({
      ...record,
      imageUrl: fileUrl(record, 'image', token ? { token, thumb: '800x0' } : { thumb: '800x0' }),
    }))
  },
  async gallery(publishedOnly = true) {
    const records = await list('gallery_images', {
      sort: 'sort_order',
      filter: publishedOnly ? 'published = true' : undefined,
    })
    return records.map((record) => ({
      ...record,
      imageUrl: fileUrl(record, 'image'),
    }))
  },
  async galleryImageById(id) {
    try {
      return await pb.collection('gallery_images').getOne(id)
    } catch (error) {
      throw normalizeApiError(error, 'Obrázek galerie se nepodařilo načíst.')
    }
  },
  async createPost(data) {
    return send('/api/monike/posts/save', { method: 'POST', body: data })
  },
  async updatePost(id, data) {
    return send('/api/monike/posts/save', { method: 'POST', body: { ...data, id } })
  },
  async deletePost(id, expectedUpdated) {
    return send(`/api/monike/posts/${encodeURIComponent(id)}/delete`, {
      method: 'POST',
      body: { expectedUpdated },
    })
  },
  async updatePostCover(id, data) {
    return updateRecord('posts', id, data)
  },
  async createGalleryImage(data) {
    return createRecord('gallery_images', data)
  },
  async updateGalleryImage(id, data) {
    return updateRecord('gallery_images', id, data)
  },
  async deleteGalleryImage(id) {
    return deleteRecord('gallery_images', id)
  },
  async reorderGallery(ids, expectedUpdated = {}) {
    return send('/api/monike/gallery/reorder', {
      method: 'POST',
      body: { ids, expectedUpdated },
    })
  },
  async landingCards() {
    return list('landing_cards', { sort: 'slot' })
  },
  async updateLandingCard(id, data) {
    return updateRecord('landing_cards', id, data)
  },
  async siteContent() {
    try {
      return await pb.collection('site_content').getFirstListItem(
        pb.filter('key = {:key}', { key: 'main' }),
      )
    } catch (error) {
      const normalized = normalizeApiError(error, 'Obsah webu se nepodařilo načíst.')
      if (normalized.kind === API_ERROR_KINDS.NOT_FOUND) {
        throw configurationError('Povinný záznam site_content[key=main] chybí.')
      }
      throw normalized
    }
  },
  async updateSiteContent(id, data) {
    return updateRecord('site_content', id, data)
  },
  async aboutPage() {
    try {
      return await pb.collection('about_page').getFirstListItem(
        pb.filter('key = {:key}', { key: 'main' }),
      )
    } catch (error) {
      const normalized = normalizeApiError(error, 'Stránku O mně se nepodařilo načíst.')
      if (normalized.kind === API_ERROR_KINDS.NOT_FOUND) {
        throw configurationError('Povinný záznam about_page[key=main] chybí.')
      }
      throw normalized
    }
  },
  async saveAbout(data) {
    return send('/api/monike/about/save', { method: 'POST', body: data })
  },
  async updateAboutPortrait(id, data) {
    return updateRecord('about_page', id, data)
  },
  async stageContentAsset(data) {
    const result = await send('/api/monike/content-assets/stage', { method: 'POST', body: data })
    let token = ''
    try {
      token = await pb.files.getToken()
    } catch (error) {
      throw normalizeApiError(error, 'Náhled obrázku se nepodařilo zpřístupnit.')
    }
    const record = result.record
    const imageUrl = fileUrl(
      { ...record, collectionId: 'content_assets', collectionName: 'content_assets' },
      'image',
      { token, thumb: '800x0' },
    )
    return { ...record, imageUrl }
  },
}
