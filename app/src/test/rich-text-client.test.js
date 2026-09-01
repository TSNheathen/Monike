import { describe, expect, it } from 'vitest'
import { isAllowedHref, normalizeHref, normalizePastedHtml } from '../lib/rich-text-client.js'

describe('klientský rich-text kontrakt', () => {
  it('přijímá pouze shodnou sadu odkazů jako server a doplní HTTPS hostnamu', () => {
    expect(normalizeHref('example.com/cesta')).toBe('https://example.com/cesta')
    expect(normalizeHref('/blog?category=cesty')).toBe('/blog?category=cesty')
    expect(isAllowedHref('mailto:monike@example.cz')).toBe(true)
    expect(normalizeHref('//example.com')).toBeNull()
    expect(normalizeHref('javascript:alert(1)')).toBeNull()
    expect(normalizeHref('../kontakt')).toBeNull()
  })

  it('normalizuje cizí HTML do podporované sémantiky bez prezentace a embedů', () => {
    const normalized = normalizePastedHtml(`
      <h1 style="color:red" class="word">Hlavní</h1>
      <p data-docs="x"><u>Text</u> <a href="javascript:alert(1)">špatně</a>
        <a style="font-size:40px" href="example.com">dobře</a></p>
      <h5>Malý</h5><pre>const ne = 'kód';</pre>
      <table><tr><td>A</td><td>B</td></tr></table>
      <img src="data:image/png;base64,abc"><iframe src="https://example.com"></iframe>
    `)

    expect(normalized).toContain('<h2>Hlavní</h2>')
    expect(normalized).toContain('<h3>Malý</h3>')
    expect(normalized).toContain('<a href="https://example.com">dobře</a>')
    expect(normalized).toContain('<p>A – B</p>')
    expect(normalized).not.toMatch(/style=|class=|javascript:|<img|<iframe|<pre|<code|<u/)
  })

  it('zploští třetí úroveň seznamu a zachová pořadí textu', () => {
    const normalized = normalizePastedHtml(`
      <ul><li>Jedna<ul><li>Dvě<ul><li>Tři A</li><li>Tři B</li></ul></li></ul></li></ul>
    `)
    expect((normalized.match(/<ul>/g) || [])).toHaveLength(2)
    expect(normalized).toContain('Tři A<br>Tři B')
  })
})
