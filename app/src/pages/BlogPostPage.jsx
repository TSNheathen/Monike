import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PublicFrame } from '../components/SiteFrame.jsx'
import { BlogLabelChips, BlogLabelNavigation, PublicRequestState } from '../components/PublicContent.jsx'
import { loadArticlePage } from '../data/public-content.js'
import { usePublicResource } from '../hooks/usePublicResource.js'
import { usePageMetadata } from '../hooks/usePageMetadata.js'
import { fileUrl, pb } from '../lib/pocketbase.js'
import { pageMetadata } from '../lib/metadata.js'
import { responsiveImage } from '../lib/media.js'

const DATE_FORMAT = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long' })

function articleCover(post) {
  if (!post.cover_image || !post.cover_width || !post.cover_height) return null
  try {
    return responsiveImage(pb, {
      record: post,
      field: 'cover_image',
      widthField: 'cover_width',
      heightField: 'cover_height',
      role: 'article-cover',
    })
  } catch {
    return null
  }
}

export default function BlogPostPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const request = usePublicResource(() => loadArticlePage(slug), [slug], ['blog_labels'])
  const result = request.state === 'ready' ? request.data?.result : null
  const labels = request.state === 'ready' ? request.data?.labels || [] : []
  const post = result?.kind === 'canonical' ? result.record : null
  const cover = post ? articleCover(post) : null

  useEffect(() => {
    if (result?.kind === 'alias') navigate(result.location, { replace: true })
  }, [navigate, result])

  const metadata = useMemo(() => {
    if (!post) {
      return pageMetadata({
        title: request.state === 'not-found' ? 'Článek nebyl nalezen | Moniké' : 'Článek | Moniké',
        description: 'Článek na blogu Moniké.',
        path: `/blog/${slug}`,
        canonical: false,
        robots: 'noindex,follow',
        image: null,
      })
    }
    return pageMetadata({
      title: `${post.title} | Moniké`,
      description: post.excerpt?.trim() || 'Článek z osobního blogu Moniké.',
      path: `/blog/${post.slug}`,
      type: 'article',
      image: post.cover_image ? fileUrl(post, 'cover_image', { thumb: '1200x630' }) : undefined,
      publishedTime: post.published_at,
    })
  }, [post, request.state, slug])
  usePageMetadata(metadata)

  return (
    <PublicFrame title={post?.title || 'Článek'}>
      {!post && result?.kind !== 'alias' && (
        <PublicRequestState state={request.state} onRetry={request.retry} retrying={request.retrying}>
          <p>Článek nebyl nalezen.</p>
          <p><Link to="/blog">Všechny články</Link> · <Link to="/">Domů</Link></p>
        </PublicRequestState>
      )}

      {post && (
        <article className="article-detail">
          <BlogLabelNavigation labels={labels} />
          <p className="content-date">{DATE_FORMAT.format(new Date(post.published_at))}</p>
          <BlogLabelChips labels={post.expand?.labels || []} />
          {cover && <img className="article-cover" alt="" {...cover} />}
          <div className="rich-content" dangerouslySetInnerHTML={{ __html: post.content_html }} />
          <p><Link className="text-link" to="/blog">Všechny články</Link></p>
        </article>
      )}
    </PublicFrame>
  )
}
