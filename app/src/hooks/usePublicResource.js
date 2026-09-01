import { useCallback, useEffect, useState } from 'react'
import { normalizeApiError } from '../lib/api-errors.js'

export function usePublicResource(load, dependencies = []) {
  const [attempt, setAttempt] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const [result, setResult] = useState({ state: 'loading', data: null, error: null })

  const retry = useCallback(() => {
    setRetrying(true)
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    let current = true
    setResult({ state: 'loading', data: null, error: null })

    async function request() {
      try {
        const data = await load()
        if (current) {
          setResult({ state: 'ready', data, error: null })
          setRetrying(false)
        }
      } catch (error) {
        if (!current) return
        const normalized = normalizeApiError(error)
        setResult({ state: normalized.kind, data: null, error: normalized })
        setRetrying(false)
      }
    }
    void request()

    return () => {
      current = false
    }
    // The caller owns the stable dependency list for its loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, attempt])

  return { ...result, retry, retrying }
}
