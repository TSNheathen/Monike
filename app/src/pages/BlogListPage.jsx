import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PublicFrame } from '../components/SiteFrame.jsx'
import { api } from '../lib/pocketbase.js'
import { samplePosts } from '../data/landing.js'

export default function BlogListPage() {
  const [posts, setPosts] = useState(samplePosts)
  const [searchParams] = useSearchParams()
  const category = searchParams.get('category')

  useEffect(() => {
    api.posts(true).then((records) => {
      if (records.length) setPosts(records)
    }).catch(() => setPosts(samplePosts))
  }, [])

  return (
    <PublicFrame title={category ? `Blog: ${category}` : 'Blog'}>
      <div className="post-list">
        {posts.map((post) => (
          <article className="post-card" key={post.id}>
            <p>{post.published_at || 'Připraveno k publikaci'}</p>
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
            <Link to={`/blog/${post.slug}`}>Číst dál</Link>
          </article>
        ))}
      </div>
    </PublicFrame>
  )
}
