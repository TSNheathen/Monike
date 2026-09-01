import { renderHook, waitFor } from '@testing-library/react'
import { usePublicResource } from './usePublicResource.js'

describe('usePublicResource', () => {
  it('zachytí synchronickou i asynchronní chybu loaderu', async () => {
    const loader = vi.fn(() => {
      throw Object.assign(new Error('missing'), { status: 404 })
    })
    const sync = renderHook(() => usePublicResource(loader))
    await waitFor(() => expect(sync.result.current.state).toBe('not-found'))
    sync.unmount()

    const asyncResult = renderHook(() => usePublicResource(async () => {
      throw Object.assign(new Error('down'), { status: 503 })
    }))
    await waitFor(() => expect(asyncResult.result.current.state).toBe('unavailable'))
  })
})
