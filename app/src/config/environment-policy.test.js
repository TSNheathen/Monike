import { resolveEnvironment, validateDeploymentEnvironment } from './environment-policy.js'

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

  it('na Vercelu odmítne chybějící nebo lokální deployment URL', () => {
    expect(() => validateDeploymentEnvironment({ isVercel: true })).toThrow(
      'explicitní VITE_APP_ENV',
    )
    expect(() => validateDeploymentEnvironment({
      appEnvironment: 'demo',
      isVercel: true,
      pocketBaseUrl: 'http://127.0.0.1:8090',
      siteUrl: 'https://demo.monike.example',
    })).toThrow('VITE_POCKETBASE_URL')
  })

  it('přijme přesné HTTPS origins pro explicitní demo build', () => {
    expect(validateDeploymentEnvironment({
      appEnvironment: 'demo',
      isVercel: true,
      pocketBaseUrl: 'https://api-demo.monike.example',
      siteUrl: 'https://demo.monike.example',
    })).toEqual({
      pocketBaseOrigin: 'https://api-demo.monike.example',
      siteOrigin: 'https://demo.monike.example',
    })
  })
})
