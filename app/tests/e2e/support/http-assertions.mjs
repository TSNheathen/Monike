import { expect } from '@playwright/test'

export function expectHttpResponse(response, { status, headers = {} }) {
  expect(response, 'HTTP odpověď musí existovat').not.toBeNull()
  expect(response.status()).toBe(status)

  const actualHeaders = response.headers()
  for (const [name, value] of Object.entries(headers)) {
    expect(actualHeaders[name.toLowerCase()]).toContain(value)
  }
}
