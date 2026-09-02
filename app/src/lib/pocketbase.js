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

async function list(collection, options, failureMessage) {
  try {
    return await pb.collection(collection).getFullList(options)
  } catch (error) {
    throw normalizeApiError(error, failureMessage || 'Seznam se nepodařilo načíst.')
  }
}

async function send(path, options, failureMessage) {
  try {
    return await pb.send(path, options)
  } catch (error) {
    throw normalizeApiError(error, failureMessage)
  }
}

async function createRecord(collection, data, failureMessage) {
  try {
    return await pb.collection(collection).create(data)
  } catch (error) {
    throw normalizeApiError(error, failureMessage || 'Záznam se nepodařilo vytvořit.')
  }
}

async function updateRecord(collection, id, data, failureMessage) {
  try {
    return await pb.collection(collection).update(id, data)
  } catch (error) {
    throw normalizeApiError(error, failureMessage || 'Změny se nepodařilo uložit.')
  }
}

async function deleteRecord(collection, id, failureMessage) {
  try {
    return await pb.collection(collection).delete(id)
  } catch (error) {
    throw normalizeApiError(error, failureMessage || 'Záznam se nepodařilo smazat.')
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
  async posts(publishedOnly = true, labelId = null) {
    return list('posts', {
      sort: '-published_at,-created',
      filter: publishedOnly ? publishedPostsFilter(pb, labelId) : undefined,
      expand: 'labels',
    }, 'Články se nepodařilo načíst.')
  },
  async postBySlug(slug) {
    const result = await send(`/api/monike/articles/${encodeURIComponent(slug)}`, {
      method: 'GET',
    }, 'Článek se nepodařilo načíst.')
    return result
  },
  async postById(id) {
    try {
      return await pb.collection('posts').getOne(id, { expand: 'labels' })
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
    }, 'Historii adres článku se nepodařilo načíst.')
  },
  async contentAssets(parentType, parentId) {
    const field = parentType === 'post' ? 'post' : 'about_page'
    const records = await list('content_assets', {
      sort: 'created',
      filter: pb.filter(`${field} = {:parentId}`, { parentId }),
    }, 'Obrázky vložené do obsahu se nepodařilo načíst.')
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
    }, 'Galerii se nepodařilo načíst.')
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
    return send('/api/monike/posts/save', { method: 'POST', body: data }, 'Článek se nepodařilo uložit.')
  },
  async updatePost(id, data) {
    return send('/api/monike/posts/save', { method: 'POST', body: { ...data, id } }, 'Článek se nepodařilo uložit.')
  },
  async deletePost(id, expectedUpdated) {
    return send(`/api/monike/posts/${encodeURIComponent(id)}/delete`, {
      method: 'POST',
      body: { expectedUpdated },
    }, 'Článek se nepodařilo smazat.')
  },
  async blogLabels() {
    return list('blog_labels', { sort: 'sort_order,name' }, 'Labely se nepodařilo načíst.')
  },
  async createBlogLabel(data) {
    return createRecord('blog_labels', data, 'Label se nepodařilo vytvořit.')
  },
  async updateBlogLabel(id, data) {
    return updateRecord('blog_labels', id, data, 'Label se nepodařilo uložit.')
  },
  async deleteBlogLabel(id) {
    return send(`/api/monike/labels/${encodeURIComponent(id)}/delete`, {
      method: 'POST',
      body: {},
    }, 'Label se nepodařilo smazat.')
  },
  async updatePostCover(id, data) {
    return updateRecord('posts', id, data, 'Titulní obrázek se nepodařilo uložit.')
  },
  async createGalleryImage(data) {
    return createRecord('gallery_images', data, 'Obrázek galerie se nepodařilo vytvořit.')
  },
  async updateGalleryImage(id, data) {
    return updateRecord('gallery_images', id, data, 'Obrázek galerie se nepodařilo uložit.')
  },
  async deleteGalleryImage(id) {
    return deleteRecord('gallery_images', id, 'Obrázek galerie se nepodařilo smazat.')
  },
  async reorderGallery(ids, expectedUpdated = {}) {
    return send('/api/monike/gallery/reorder', {
      method: 'POST',
      body: { ids, expectedUpdated },
    }, 'Pořadí galerie se nepodařilo uložit.')
  },
  async landingCards() {
    return list('landing_cards', { sort: 'slot', expand: 'label' }, 'Karty úvodní stránky se nepodařilo načíst.')
  },
  async updateLandingCard(id, data) {
    return updateRecord('landing_cards', id, data, 'Kartu úvodní stránky se nepodařilo uložit.')
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
    return updateRecord('site_content', id, data, 'Texty webu se nepodařilo uložit.')
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
    return send('/api/monike/about/save', { method: 'POST', body: data }, 'Stránku O mně se nepodařilo uložit.')
  },
  async updateAboutPortrait(id, data) {
    return updateRecord('about_page', id, data, 'Portrét stránky O mně se nepodařilo uložit.')
  },
  async stageContentAsset(data) {
    const result = await send('/api/monike/content-assets/stage', { method: 'POST', body: data }, 'Obrázek se nepodařilo nahrát do obsahu.')
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
