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
export default function DraggableFab({ storageKey, children, className = '' }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<Pos>(() => {
    const saved = loadPos(storageKey)
    if (saved) return saved
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    return mobile ? { right: 14, bottom: 74 } : { right: 20, bottom: 20 }
  })
  const drag = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = pos.left ?? window.innerWidth - rect.width - (pos.right ?? 0)
    const top = pos.top ?? window.innerHeight - rect.height - (pos.bottom ?? 0)
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, left, top, moved: false }
    justDragged.current = false
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = ref.current
    if (!d || !el || e.pointerId !== d.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
    const rect = el.getBoundingClientRect()
    const x = clamp(d.left + dx, 4, Math.max(4, window.innerWidth - rect.width - 4))
    const y = clamp(d.top + dy, 4, Math.max(4, window.innerHeight - rect.height - 4))
    setPos({ left: x, top: y })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = ref.current
    if (!d || !el || e.pointerId !== d.pointerId) return
    drag.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (d.moved) {
      justDragged.current = true
      const rect = el.getBoundingClientRect()
      savePos(storageKey, { left: rect.left, top: rect.top })
    } else {
      justDragged.current = false
    }
  }

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current && e.pointerId === drag.current.pointerId) drag.current = null
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
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={onCaptureClick}
      title="Drag to move · tap to open"
    >
      {children}
    </div>
  )
}