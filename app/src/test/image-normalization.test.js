import { describe, expect, it } from 'vitest'
import { canonicalMime, normalizedDimensions } from '../lib/image-normalization.js'

describe('normalizace webového masteru', () => {
  it('nikdy neupscaluje a omezí delší stranu na 4096 px', () => {
    expect(normalizedDimensions(1200, 800)).toEqual({ width: 1200, height: 800 })
    expect(normalizedDimensions(6000, 3000)).toEqual({ width: 4096, height: 2048 })
  })

  it('odmítne vstup nad bezpečnostním limitem', () => {
    expect(() => normalizedDimensions(8192, 4096)).toThrow(/32 megapixelů/)
    expect(() => normalizedDimensions(9000, 100)).toThrow(/8192 px/)
  })

  it('zachová PNG a převede WebP podle alfa kanálu', () => {
    expect(canonicalMime('image/png', false)).toBe('image/png')
    expect(canonicalMime('image/webp', false)).toBe('image/jpeg')
    expect(canonicalMime('image/webp', true)).toBe('image/png')
    expect(canonicalMime('image/jpeg', false)).toBe('image/jpeg')
  })
})
