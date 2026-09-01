import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function Dialog({ open, title, children, onClose, initialFocusRef }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const returnFocusRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    returnFocusRef.current = document.activeElement
    const dialog = dialogRef.current
    const layer = dialog?.parentElement
    for (const element of document.body.children) {
      if (element !== layer) element.inert = true
    }
    const focusTarget = initialFocusRef?.current || dialog?.querySelector('[data-dialog-initial]') || dialog?.querySelector(FOCUSABLE)
    focusTarget?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const controls = [...dialog.querySelectorAll(FOCUSABLE)]
      if (!controls.length) return
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
    document.body.classList.add('has-modal')
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      for (const element of document.body.children) {
        if (element !== layer) element.inert = false
      }
      document.body.classList.remove('has-modal')
      returnFocusRef.current?.focus?.()
    }
  }, [initialFocusRef, open])

  if (!open) return null

  return createPortal(
    <div className="dialog-backdrop">
      <section
        ref={dialogRef}
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Zavřít dialog">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
