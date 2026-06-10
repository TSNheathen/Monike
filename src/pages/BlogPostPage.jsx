import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PublicFrame } from '../components/SiteFrame.jsx'
import { api } from '../lib/pocketbase.js'
import { samplePosts } from '../data/landing.js'

export default function BlogPostPage() {
  const { slug } = useParams()
  const [post, setPost] = useState(samplePosts.find((item) => item.slug === slug) || samplePosts[0])

  useEffect(() => {
    api.postBySlug(slug).then(setPost).catch(() => {})
  }, [slug])

  return (
    <PublicFrame title={post.title}>
      <p className="content-date">{post.published_at}</p>
      <div className="rich-content" dangerouslySetInnerHTML={{ __html: post.content_html || '' }} />
    </PublicFrame>
  )
}
