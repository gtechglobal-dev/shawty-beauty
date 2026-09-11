import { useCallback, useRef, useState } from 'react'

interface Pos {
  left?: number
  top?: number
  right?: number
  bottom?: number
}

interface Props {
  storageKey: string
  children: React.ReactNode
  className?: string
}

function loadPos(key: string): Pos | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (p && typeof p.left === 'number' && typeof p.top === 'number') return p
  } catch {
    /* ignore */
  }
  return null
}

function savePos(key: string, p: Pos) {
  try {
    localStorage.setItem(key, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

// A floating action button the owner can grab and drag to any corner of the
// screen. The position is remembered per page (localStorage) so it stays where
// it was dropped. A tap still activates the link; a drag does not.
//
// Note: we deliberately do NOT use setPointerCapture here. Capturing the pointer
// makes the browser retarget the closing `click` event to this wrapper element,
// so the inner <Link> would never receive it and taps would do nothing.
export default function DraggableFab({ storageKey, children, className = '' }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<Pos>(() => {
    const saved = loadPos(storageKey)
    if (saved) return saved
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    return mobile ? { right: 14, bottom: 74 } : { right: 20, bottom: 20 }
  })
  const drag = useRef<{ startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)

  const onWindowMove = useCallback((e: PointerEvent) => {
    const d = drag.current
    const el = ref.current
    if (!d || !el) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
    const rect = el.getBoundingClientRect()
    const x = clamp(d.left + dx, 4, Math.max(4, window.innerWidth - rect.width - 4))
    const y = clamp(d.top + dy, 4, Math.max(4, window.innerHeight - rect.height - 4))
    setPos({ left: x, top: y })
  }, [])

  const endDrag = useCallback((moved: boolean) => {
    window.removeEventListener('pointermove', onWindowMove)
    window.removeEventListener('pointerup', onWindowUp)
    window.removeEventListener('pointercancel', onWindowCancel)
    drag.current = null
    if (moved && ref.current) {
      justDragged.current = true
      const rect = ref.current.getBoundingClientRect()
      savePos(storageKey, { left: rect.left, top: rect.top })
    } else {
      justDragged.current = false
    }
  }, [onWindowMove, storageKey])

  const onWindowUp = useCallback(() => endDrag(drag.current?.moved ?? false), [endDrag])
  const onWindowCancel = useCallback(() => endDrag(false), [endDrag])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = pos.left ?? window.innerWidth - rect.width - (pos.right ?? 0)
    const top = pos.top ?? window.innerHeight - rect.height - (pos.bottom ?? 0)
    drag.current = { startX: e.clientX, startY: e.clientY, left, top, moved: false }
    justDragged.current = false
    window.addEventListener('pointermove', onWindowMove)
    window.addEventListener('pointerup', onWindowUp)
    window.addEventListener('pointercancel', onWindowCancel)
  }

  // Suppress the underlying link click if the pointer just dragged the fab.
  const onCaptureClick = useCallback((e: React.MouseEvent) => {
    if (justDragged.current) {
      e.preventDefault()
      e.stopPropagation()
      justDragged.current = false
    }
  }, [])

  return (
    <div
      ref={ref}
      style={pos.left !== undefined && pos.top !== undefined ? { left: pos.left, top: pos.top } : ({ ...pos } as React.CSSProperties)}
      className={`fixed z-50 cursor-grab active:cursor-grabbing touch-none select-none ${className}`}
      onPointerDown={onPointerDown}
      onClickCapture={onCaptureClick}
      title="Drag to move · tap to open"
    >
      {children}
    </div>
  )
}