import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

let previousApplicationRoute = null

export function useRouteFocus() {
  const location = useLocation()
  const targetRef = useRef(null)

  useEffect(() => {
    const route = `${location.pathname}${location.search}`
    const routeChanged = previousApplicationRoute !== null && previousApplicationRoute !== route
    previousApplicationRoute = route
    if (routeChanged) {
      const frame = requestAnimationFrame(() => {
        targetRef.current?.focus({ preventScroll: true })
        targetRef.current?.scrollIntoView?.({ block: 'start' })
      })
      return () => cancelAnimationFrame(frame)
    }
    return undefined
  }, [location.pathname, location.search])

  return targetRef
}
