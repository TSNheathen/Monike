import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BlogListPage from './BlogListPage.jsx'

const content = vi.hoisted(() => ({ loadBlogListing: vi.fn() }))
vi.mock('../data/public-content.js', () => ({
  loadBlogLabels: async () => [],
  loadBlogListing: content.loadBlogListing,
  loadLandingContent: async () => ({ cards: [], site: null }),
}))

function renderPage(url = '/blog') {
  return render(<MemoryRouter initialEntries={[url]}><BlogListPage /></MemoryRouter>)
}

const post = {
  id: 'post1',
  title: 'Skutečný článek',
  slug: 'skutecny-clanek',
  excerpt: 'Perex článku.',
  labels: ['labelcesty00001'],
  expand: { labels: [{ id: 'labelcesty00001', name: 'Cesty & příběhy', slug: 'cesty', color: '#B88A36' }] },
  published_at: '2026-09-01 12:00:00.000Z',
}

describe('veřejný seznam blogu', () => {
  beforeEach(() => content.loadBlogListing.mockReset())

  it('nerenderuje empty před dokončením požadavku', async () => {
    let resolve
    content.loadBlogListing.mockReturnValue(new Promise((done) => { resolve = done }))
    renderPage()
    expect(within(screen.getByRole('main')).getByRole('status')).toHaveTextContent('Načítám obsah')
    expect(screen.queryByText('Zatím tu nejsou')).not.toBeInTheDocument()
    resolve({ kind: 'ready', labels: [], selectedLabel: null, posts: [] })
    expect(await screen.findByText('Zatím tu nejsou žádné publikované články.')).toBeInTheDocument()
  })

  it('úspěšné prázdné pole zůstává skutečný empty stav bez fixtures', async () => {
    content.loadBlogListing.mockResolvedValue({ kind: 'ready', labels: [], selectedLabel: null, posts: [] })
    renderPage()
    expect(await screen.findByText('Zatím tu nejsou žádné publikované články.')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Postranní panel Moniké' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Hlavní navigace' })).toBeInTheDocument()
    expect(screen.queryByText('Skutečný článek')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zkusit znovu' })).not.toBeInTheDocument()
  })

  it('technickou chybu nezmění na empty a retry zopakuje stejný read', async () => {
    const user = userEvent.setup()
    content.loadBlogListing
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ kind: 'ready', labels: [], selectedLabel: null, posts: [post] })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Zkusit znovu' }))
    expect(await screen.findByRole('heading', { name: post.title })).toBeInTheDocument()
    expect(content.loadBlogListing).toHaveBeenCalledTimes(2)
  })

  it('neplatný či opakovaný label odmítne bez PocketBase dotazu', async () => {
    renderPage('/blog?label=cesty&label=vzpominky')
    expect(await screen.findByRole('heading', { name: 'Tento label neexistuje.' })).toBeInTheDocument()
    expect(content.loadBlogListing).not.toHaveBeenCalled()
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
  })

  it('validní label resolve dynamicky a vykreslí jeho název i barvu', async () => {
    const label = post.expand.labels[0]
    content.loadBlogListing.mockResolvedValue({ kind: 'ready', labels: [label], selectedLabel: label, posts: [post] })
    renderPage('/blog?label=cesty&utm_source=test')
    expect(await screen.findByRole('heading', { name: 'Skutečný článek' })).toBeInTheDocument()
    expect(content.loadBlogListing).toHaveBeenCalledWith('cesty')
    expect(screen.getAllByRole('link', { name: 'Cesty & příběhy' })[0]).toHaveStyle('--label-color: #B88A36')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://127.0.0.1:5173/blog?label=cesty',
    )
  })
})
