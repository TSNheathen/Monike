import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import BlogPostPage from './BlogPostPage.jsx'

const content = vi.hoisted(() => ({ loadArticle: vi.fn() }))
vi.mock('../data/public-content.js', () => ({ loadArticle: content.loadArticle }))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/blog/clanek']}>
      <Routes>
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/blog/novy" element={<p>Nová canonical trasa</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const record = {
  id: 'post1',
  title: 'Canonical článek',
  slug: 'clanek',
  excerpt: 'Bezpečný perex.',
  categories: ['cesty'],
  published_at: '2026-09-01 12:00:00.000Z',
  content_html: '<p><strong>Serverový obsah</strong></p>',
  cover_image: '',
}

describe('veřejný detail článku', () => {
  beforeEach(() => content.loadArticle.mockReset())

  it('vykreslí pouze canonical serverový záznam a metadata', async () => {
    content.loadArticle.mockResolvedValue({ kind: 'canonical', record })
    renderPage()
    expect(await screen.findByText('Serverový obsah')).toBeInTheDocument()
    expect(document.title).toBe('Canonical článek | Moniké')
    expect(document.querySelector('meta[property="og:type"]')).toHaveAttribute('content', 'article')
  })

  it('historický slug nahradí canonical trasou bez duplicitního článku', async () => {
    content.loadArticle.mockResolvedValue({ kind: 'alias', location: '/blog/novy' })
    renderPage()
    expect(await screen.findByText('Nová canonical trasa')).toBeInTheDocument()
    expect(screen.queryByText('Serverový obsah')).not.toBeInTheDocument()
  })
})
