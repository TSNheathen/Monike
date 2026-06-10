import PocketBase from 'pocketbase'

export const pb = new PocketBase(
  import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090',
)

function fileUrl(record, field) {
  const value = record?.[field]
  if (!record || !value) return ''
  return pb.files.getURL(record, value)
}

async function list(collection, options) {
  return pb.collection(collection).getFullList(options)
}

export const api = {
  isAdmin() {
    return pb.authStore.isValid
  },
  async login(email, password) {
    return pb.collection('admins').authWithPassword(email, password)
  },
  logout() {
    pb.authStore.clear()
  },
  async posts(publishedOnly = true) {
    return list('posts', {
      sort: '-published_at,-created',
      filter: publishedOnly ? 'published = true' : undefined,
    })
  },
  async postBySlug(slug) {
    return pb.collection('posts').getFirstListItem(`slug = "${slug}" && published = true`)
  },
  async gallery(publishedOnly = true) {
    const records = await list('gallery_images', {
      sort: 'sort_order,created',
      filter: publishedOnly ? 'published = true' : undefined,
    })
    return records.map((record) => ({
      ...record,
      imageUrl: fileUrl(record, 'image'),
    }))
  },
  async createPost(data) {
    return pb.collection('posts').create(data)
  },
  async updatePost(id, data) {
    return pb.collection('posts').update(id, data)
  },
  async deletePost(id) {
    return pb.collection('posts').delete(id)
  },
  async createGalleryImage(data) {
    return pb.collection('gallery_images').create(data)
  },
  async updateGalleryImage(id, data) {
    return pb.collection('gallery_images').update(id, data)
  },
  async deleteGalleryImage(id) {
    return pb.collection('gallery_images').delete(id)
  },
}
