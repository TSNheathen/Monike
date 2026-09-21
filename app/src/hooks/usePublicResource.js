import { useCallback, useEffect, useState } from 'react'
import { normalizeApiError } from '../lib/api-errors.js'
import { pb } from '../lib/pocketbase.js'
import { DEV_FIXTURES_ENABLED } from '../config/environment.js'

export function usePublicResource(load, dependencies = [], collections = []) {
  const [attempt, setAttempt] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const [result, setResult] = useState({ state: 'loading', data: null, error: null })
  const subscriptions = collections.join(',')

  const retry = useCallback(() => {
    setRetrying(true)
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    let current = true
    let sequence = 0
    const unsubscribe = []
    setResult({ state: 'loading', data: null, error: null })

    async function request() {
      const version = ++sequence
      try {
        const data = await load()
        if (current && version === sequence) {
          setResult({ state: 'ready', data, error: null })
          setRetrying(false)
        }
      } catch (error) {
        if (!current || version !== sequence) return
        const normalized = normalizeApiError(error)
        setResult({ state: normalized.kind, data: null, error: normalized })
        setRetrying(false)
      }
    }
    void request()

    if (subscriptions && !DEV_FIXTURES_ENABLED && typeof EventSource !== 'undefined') {
      for (const collection of subscriptions.split(',')) {
        pb.collection(collection).subscribe('*', request).then((stop) => {
          if (current) unsubscribe.push(stop)
          else stop()
        }).catch(() => {
          // A tab regaining focus also refreshes after a disconnected stream.
        })
      }
      window.addEventListener('focus', request)
    }

    return () => {
      current = false
      for (const stop of unsubscribe) stop()
      window.removeEventListener('focus', request)
    }
    // The caller owns the stable dependency list for its loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, attempt, subscriptions])

  return { ...result, retry, retrying }
}
