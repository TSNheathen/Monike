import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App.jsx'

vi.mock('./data/public-content.js', () => ({
  loadLandingContent: async () => ({
    site: {
      hero_subtitle: 'Tvořím. Cestuji. Žiju.',
      hero_body: 'Umění je můj jazyk.\nCestování moje inspirace.',
      hero_cta_label: 'VSTOUPIT DO MÉHO SVĚTA',
      signature_text: 'Collect moments, not things',
      instagram_url: 'https://www.instagram.com/',
      facebook_url: 'https://www.facebook.com/',
    },
    cards: [
      ['gallery', 'GALERIE', '/gallery'],
      ['cesty', 'CESTY & PŘÍBĚHY', '/blog?category=cesty'],
      ['vzpominky', 'VZPOMÍNKY', '/blog?category=vzpominky'],
      ['kocicky-andy', 'KOČIČKY & ANDY', '/blog?category=kocicky-andy'],
      ['proces-tvorby', 'PROCES TVORBY', '/blog?category=proces-tvorby'],
    ].map(([slot, title, href]) => ({
      id: slot,
      slot,
      title,
      href,
      description: 'Testovací popis',
      image: '/assets/landing/card-galerie.png',
      image_width: 1024,
      image_height: 1536,
    })),
  }),
}))

function renderRoute(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  )
}

describe('Moniké aplikace', () => {
  it('vykreslí vrstvenou českou landing page bez zapečeného UI', async () => {
    renderRoute('/')

    expect(await screen.findByRole('heading', { name: 'Moniké' })).toBeInTheDocument()
    expect(screen.getByText('Tvořím. Cestuji. Žiju.')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'VSTOUPIT DO MÉHO SVĚTA' }),
    ).toHaveAttribute('href', '/gallery')

    const navigation = screen.getByRole('navigation', { name: 'Hlavní navigace' })
    expect(within(navigation).getByRole('link', { name: 'DOMŮ' })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: 'GALERIE' })).toBeInTheDocument()
    expect(
      within(navigation).getByRole('link', { name: 'CESTY & PŘÍBĚHY' }),
    ).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: 'O MNĚ' })).toBeInTheDocument()
    expect(
      within(navigation).getByRole('link', { name: 'KOČIČKY & ANDY' }),
    ).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: 'KONTAKT' })).toBeInTheDocument()

    expect(screen.getAllByTestId('category-card')).toHaveLength(5)
    expect(screen.getByRole('link', { name: /Instagram Moniké/i })).toHaveAttribute('href', 'https://www.instagram.com/')
    expect(screen.getByRole('link', { name: /Facebook Moniké/i })).toHaveAttribute('href', 'https://www.facebook.com/')
  })

  it('otevře mobilní menu s přístupným stavem aria-expanded', async () => {
    const user = userEvent.setup()
    renderRoute('/')

    const button = screen.getByRole('button', { name: 'Otevřít menu' })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Mobilní navigace' })).toBeInTheDocument()
  })

  it('chrání administraci a nabízí přihlášení v češtině', async () => {
    renderRoute('/admin/blog/new')

    expect(await screen.findByRole('heading', { name: 'Přihlášení' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Přihlásit' })).toBeInTheDocument()
  })
})
