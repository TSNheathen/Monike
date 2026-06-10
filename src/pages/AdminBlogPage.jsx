import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminFrame } from '../components/SiteFrame.jsx'
import { api } from '../lib/pocketbase.js'
import { samplePosts } from '../data/landing.js'

export default function AdminBlogPage() {
  const [posts, setPosts] = useState(samplePosts)

  useEffect(() => {
    api.posts(false).then((records) => {
      if (records.length) setPosts(records)
    }).catch(() => setPosts(samplePosts))
  }, [])

  return (
    <AdminFrame
      title="Správa blogu"
      actions={<Link className="admin-action" to="/admin/blog/new">Nový článek</Link>}
    >
      <div className="admin-table">
        {posts.map((post) => (
          <article key={post.id}>
            <div>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
            </div>
            <Link to={`/admin/blog/${post.id}/edit`}>Upravit</Link>
          </article>
        ))}
      </div>
    </AdminFrame>
  )
}
