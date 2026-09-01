import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function setBackgroundInert(layer, inert) {
  for (const element of document.body.children) {
    if (element !== layer) element.inert = inert
  }
}

export default function ModalDrawer({ open, id, label, triggerRef, onClose, children }) {
  const layerRef = useRef(null)
  const drawerRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const layer = layerRef.current
    const drawer = drawerRef.current
    const returnFocus = triggerRef?.current || document.activeElement
    setBackgroundInert(layer, true)
    document.body.classList.add('has-modal')
    drawer?.querySelector(FOCUSABLE)?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !drawer) return
      const controls = [...drawer.querySelectorAll(FOCUSABLE)]
      if (!controls.length) {
        event.preventDefault()
        drawer.focus()
        return
      }
      const first = controls[0]
      const last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      setBackgroundInert(layer, false)
      document.body.classList.remove('has-modal')
      returnFocus?.focus?.()
    }
  }, [open, triggerRef])

  if (!open) return null
  return createPortal(
    <div ref={layerRef} className="drawer-backdrop">
      <aside
        ref={drawerRef}
        id={id}
        className="modal-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex="-1"
      >
        {children}
      </aside>
    </div>,
    document.body,
  )
}
