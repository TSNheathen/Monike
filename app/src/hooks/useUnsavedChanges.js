import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function useUnsavedChanges(dirty) {
  const navigate = useNavigate()
  const dirtyRef = useRef(dirty)
  const bypassRef = useRef(false)
  const [pendingLocation, setPendingLocation] = useState(null)

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    function warnBeforeUnload(event) {
      if (!dirtyRef.current || bypassRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    function guardInternalLink(event) {
      if (!dirtyRef.current || bypassRef.current || event.defaultPrevented || event.button !== 0) return
      const link = event.target.closest?.('a[href]')
      if (!link || link.target || link.hasAttribute('download')) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const destination = `${url.pathname}${url.search}${url.hash}`
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (destination === current) return
      event.preventDefault()
      setPendingLocation(destination)
    }

    window.addEventListener('beforeunload', warnBeforeUnload)
    document.addEventListener('click', guardInternalLink, true)
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload)
      document.removeEventListener('click', guardInternalLink, true)
    }
  }, [])

  function allowNextNavigation() {
    bypassRef.current = true
    dirtyRef.current = false
  }

  function discardAndLeave() {
    if (!pendingLocation) return
    const destination = pendingLocation
    allowNextNavigation()
    setPendingLocation(null)
    navigate(destination)
  }

  return {
    pendingLocation,
    allowNextNavigation,
    discardAndLeave,
    stay: () => setPendingLocation(null),
  }
}
