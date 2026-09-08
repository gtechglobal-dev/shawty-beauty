import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({
  open,
  onClose,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  // Render at <body> level (portal) so `position: fixed` is always anchored to
  // the viewport — a transformed/filtered ancestor would otherwise relocate the
  // modal off-screen relative to the current scroll position.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[85vh] flex flex-col overflow-hidden rounded-3xl`}
      >
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-rose/40 to-transparent" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-blush text-rose-deep flex items-center justify-center hover:bg-rose hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
        <div className="overflow-y-auto overscroll-contain p-6 sm:p-8">{children}</div>
      </div>
    </div>,
    document.body,
  )
}