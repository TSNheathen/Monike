import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RichTextEditor from '../components/RichTextEditor.jsx'
import { EMPTY_RICH_TEXT } from '../lib/rich-text-client.js'

describe('RichTextEditor', () => {
  it('vystaví přesně smluvené viditelné nástroje', () => {
    render(<RichTextEditor value={EMPTY_RICH_TEXT} onChange={vi.fn()} />)
    const toolbar = screen.getByRole('toolbar', { name: 'Nástroje editoru' })
    const labels = [...toolbar.querySelectorAll('button')].map((button) => button.textContent)

    expect(labels).toEqual([
      'Odstavec',
      'Nadpis 2',
      'Nadpis 3',
      'Tučně',
      'Kurzíva',
      'Odkaz',
      'Odrážkový seznam',
      'Číslovaný seznam',
      'Citace',
      'Vložit obrázek',
      'Zpět',
      'Znovu',
    ])
    expect(toolbar).not.toHaveTextContent(/H1|Přeškrtnutí|Kód|Oddělovač/)
  })
})
