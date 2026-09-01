import { resolveEnvironment } from './environment-policy.js'

describe('konfigurace prostředí', () => {
  it('zapne DEV fixtures pouze ve vývojovém prostředí', () => {
    expect(resolveEnvironment({ mode: 'development' })).toEqual({
      name: 'development',
      useDevFixtures: true,
    })
    expect(resolveEnvironment({ mode: 'production' })).toEqual({
      name: 'production',
      useDevFixtures: false,
    })
  })

  it('odmítne DEV fixtures mimo vývojové prostředí', () => {
    expect(() =>
      resolveEnvironment({
        mode: 'production',
        appEnvironment: 'demo',
        devFixtures: 'true',
      }),
    ).toThrow('DEV fixtures nelze zapnout')
  })

  it('odmítne neznámé prostředí a neplatný přepínač', () => {
    expect(() => resolveEnvironment({ mode: 'preview' })).toThrow(
      'Neznámé prostředí',
    )
    expect(() =>
      resolveEnvironment({ mode: 'development', devFixtures: 'ano' }),
    ).toThrow('musí být true nebo false')
  })
})
