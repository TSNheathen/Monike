import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BlogListPage from './BlogListPage.jsx'

const content = vi.hoisted(() => ({ loadPosts: vi.fn() }))
vi.mock('../data/public-content.js', () => ({ loadPosts: content.loadPosts }))

function renderPage(url = '/blog') {
  return render(<MemoryRouter initialEntries={[url]}><BlogListPage /></MemoryRouter>)
}

const post = {
  id: 'post1',
  title: 'Skutečný článek',
  slug: 'skutecny-clanek',
  excerpt: 'Perex článku.',
  categories: ['cesty'],
  published_at: '2026-09-01 12:00:00.000Z',
}

describe('veřejný seznam blogu', () => {
  beforeEach(() => content.loadPosts.mockReset())

  it('nerenderuje empty před dokončením požadavku', async () => {
    let resolve
    content.loadPosts.mockReturnValue(new Promise((done) => { resolve = done }))
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Načítám obsah')
    expect(screen.queryByText('Zatím tu nejsou')).not.toBeInTheDocument()
    resolve([])
    expect(await screen.findByText('Zatím tu nejsou žádné publikované články.')).toBeInTheDocument()
  })

  it('úspěšné prázdné pole zůstává skutečný empty stav bez fixtures', async () => {
    content.loadPosts.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Zatím tu nejsou žádné publikované články.')).toBeInTheDocument()
    expect(screen.queryByText('Skutečný článek')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zkusit znovu' })).not.toBeInTheDocument()
  })

  it('technickou chybu nezmění na empty a retry zopakuje stejný read', async () => {
    const user = userEvent.setup()
    content.loadPosts
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce([post])
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Zkusit znovu' }))
    expect(await screen.findByRole('heading', { name: post.title })).toBeInTheDocument()
    expect(content.loadPosts).toHaveBeenCalledTimes(2)
  })

  it('neplatnou či opakovanou kategorii odmítne bez PocketBase dotazu', async () => {
    renderPage('/blog?category=cesty&category=vzpominky')
    expect(await screen.findByRole('heading', { name: 'Tato kategorie neexistuje.' })).toBeInTheDocument()
    expect(content.loadPosts).not.toHaveBeenCalled()
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
  })

  it('validní kategorii předá jako pevný klíč a vykreslí její český název', async () => {
    content.loadPosts.mockResolvedValue([post])
    renderPage('/blog?category=cesty&utm_source=test')
    expect(await screen.findByRole('heading', { name: 'Skutečný článek' })).toBeInTheDocument()
    expect(content.loadPosts).toHaveBeenCalledWith('cesty')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://127.0.0.1:5173/blog?category=cesty',
    )
  })
})
