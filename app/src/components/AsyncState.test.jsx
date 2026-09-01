import { render, screen } from '@testing-library/react'
import { StatePanel, StatusMessage } from './AsyncState.jsx'

describe('sdílené stavové prvky', () => {
  it('označí načítání jako živý busy stav a chybu jako alert', () => {
    const { rerender } = render(<StatePanel state="loading" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')

    rerender(<StatePanel state="error" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Obsah se nepodařilo načíst')
  })

  it('úspěšnou zprávu oznamuje bez přesunu fokusu', () => {
    render(<StatusMessage kind="success">Uloženo</StatusMessage>)
    expect(screen.getByRole('status')).toHaveTextContent('Uloženo')
  })
})
