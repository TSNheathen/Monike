import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PublicFrame } from '../components/SiteFrame.jsx'
import { BlogLabelChips, BlogLabelNavigation, PublicRequestState } from '../components/PublicContent.jsx'
import { loadBlogListing } from '../data/public-content.js'
import { usePublicResource } from '../hooks/usePublicResource.js'
import { usePageMetadata } from '../hooks/usePageMetadata.js'
import { pageMetadata } from '../lib/metadata.js'
import { parseLabelQuery } from '../lib/queries.js'
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
  const query = parseLabelQuery(searchParams)
  const request = usePublicResource(
    () => query.state === 'invalid' ? null : loadBlogListing(query.slug),
    [query.state, query.slug],
  )
  const listing = request.state === 'ready' ? request.data : null
  const labels = Array.isArray(listing?.labels) ? listing.labels : []
  const selectedLabel = listing?.selectedLabel || null
  const posts = Array.isArray(listing?.posts) ? listing.posts : []
  const invalid = query.state === 'invalid' || listing?.kind === 'invalid'
  const displayState = invalid
    ? 'invalid'
    : request.state === 'ready' && posts.length === 0 ? 'empty' : request.state
  const hasDataError = ['unavailable', 'error', 'configuration'].includes(request.state)

  const metadata = useMemo(() => {
    if (invalid) {
      return pageMetadata({
        title: 'Neplatný label | Moniké',
        description: 'Blog Moniké.',
        path: '/blog',
        robots: 'noindex,follow',
      })
    }
    return pageMetadata({
      title: selectedLabel ? `${selectedLabel.name} | Blog | Moniké` : 'Blog | Moniké',
      description: selectedLabel
        ? `Články Moniké označené labelem ${selectedLabel.name}.`
        : 'Články Moniké o cestách, vzpomínkách, zvířatech a procesu tvorby.',
      path: selectedLabel ? `/blog?label=${selectedLabel.slug}` : '/blog',
      robots: hasDataError ? 'noindex,follow' : 'index,follow',
    })
  }, [hasDataError, invalid, selectedLabel])
  usePageMetadata(metadata)

  const title = selectedLabel?.name || 'Blog'

  return (
    <PublicFrame title={title}>
      <BlogLabelNavigation labels={labels} currentSlug={selectedLabel?.slug || null} />

      {displayState === 'invalid' ? (
        <PublicRequestState state="invalid">
          <section className="state-panel state-panel--invalid">
            <div>
              <h2>Tento label neexistuje.</h2>
              <p>Vyber jeden z dostupných labelů nebo zobraz celý blog.</p>
              <Link className="button button--secondary" to="/blog">Zobrazit celý blog</Link>
            </div>
          </section>
        </PublicRequestState>
      ) : (
        <PublicRequestState
          state={displayState}
          emptyMessage={selectedLabel
            ? 'S tímto labelem zatím nejsou žádné publikované články.'
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
                    <BlogLabelChips labels={post.expand?.labels || []} />
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
