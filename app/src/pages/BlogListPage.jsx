import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PublicFrame } from '../components/SiteFrame.jsx'
import { BlogCategoryNavigation, PublicRequestState } from '../components/PublicContent.jsx'
import { getBlogCategory } from '../config/categories.js'
import { loadPosts } from '../data/public-content.js'
import { usePublicResource } from '../hooks/usePublicResource.js'
import { usePageMetadata } from '../hooks/usePageMetadata.js'
import { pageMetadata } from '../lib/metadata.js'
import { parseCategoryQuery } from '../lib/queries.js'
import { pb } from '../lib/pocketbase.js'
import { responsiveImage } from '../lib/media.js'

const DATE_FORMAT = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long' })

function coverProps(post) {
  if (!post.cover_image || !post.cover_width || !post.cover_height) return null
  try {
    return responsiveImage(pb, {
      record: post,
      field: 'cover_image',
      widthField: 'cover_width',
      heightField: 'cover_height',
      role: 'blog-list',
    })
  } catch {
    return null
  }
}

export default function BlogListPage() {
  const [searchParams] = useSearchParams()
  const query = parseCategoryQuery(searchParams)
  const categoryKey = query.state === 'valid' ? query.key : null
  const request = usePublicResource(
    () => query.state === 'invalid' ? null : loadPosts(categoryKey),
    [query.state, categoryKey],
  )
  const posts = Array.isArray(request.data) ? request.data : []
  const displayState = query.state === 'invalid'
    ? 'invalid'
    : request.state === 'ready' && posts.length === 0 ? 'empty' : request.state
  const hasDataError = ['unavailable', 'error', 'configuration'].includes(request.state)

  const metadata = useMemo(() => {
    if (query.state === 'invalid') {
      return pageMetadata({
        title: 'Neplatná kategorie | Moniké',
        description: 'Blog Moniké.',
        path: '/blog',
        robots: 'noindex,follow',
      })
    }
    const category = query.state === 'valid' ? query.category : null
    return pageMetadata({
      title: category ? `${category.label} | Blog | Moniké` : 'Blog | Moniké',
      description: category
        ? `Články Moniké v kategorii ${category.label}.`
        : 'Články Moniké o cestách, vzpomínkách, zvířatech a procesu tvorby.',
      path: category ? `/blog?category=${category.key}` : '/blog',
      robots: hasDataError ? 'noindex,follow' : 'index,follow',
    })
  }, [hasDataError, query.category, query.state])
  usePageMetadata(metadata)

  const title = query.state === 'valid' ? query.category.label : 'Blog'

  return (
    <PublicFrame title={title}>
      <BlogCategoryNavigation currentKey={categoryKey} />

      {displayState === 'invalid' ? (
        <PublicRequestState state="invalid">
          <section className="state-panel state-panel--invalid">
            <div>
              <h2>Tato kategorie neexistuje.</h2>
              <p>Vyber jednu z dostupných kategorií nebo zobraz celý blog.</p>
              <Link className="button button--secondary" to="/blog">Zobrazit celý blog</Link>
            </div>
          </section>
        </PublicRequestState>
      ) : (
        <PublicRequestState
          state={displayState}
          emptyMessage={categoryKey
            ? 'V této kategorii zatím nejsou žádné publikované články.'
            : 'Zatím tu nejsou žádné publikované články.'}
          onRetry={request.retry}
          retrying={request.retrying}
        >
          <div className="post-list">
            {posts.map((post) => {
              const cover = coverProps(post)
              return (
                <article className="post-card" key={post.id}>
                  {cover && <img className="post-card__cover" alt="" {...cover} />}
                  <div className="post-card__body">
                    <p className="content-date">{DATE_FORMAT.format(new Date(post.published_at))}</p>
                    <h2>{post.title}</h2>
                    {post.excerpt && <p>{post.excerpt}</p>}
                    <div className="category-chips" aria-label="Kategorie článku">
                      {(post.categories || []).map((key) => {
                        const category = getBlogCategory(key)
                        return category && <Link key={key} to={`/blog?category=${key}`}>{category.label}</Link>
                      })}
                    </div>
                    <Link className="text-link" to={`/blog/${post.slug}`}>Číst dál</Link>
                  </div>
                </article>
              )
            })}
          </div>
        </PublicRequestState>
      )}
    </PublicFrame>
  )
}
