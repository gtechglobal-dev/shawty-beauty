import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleCheck, CircleAlert, X } from 'lucide-react'

type ToastType = 'ok' | 'err'

interface ToastItem {
  id: number
  type: ToastType
  text: string
  leaving?: boolean
}

interface ToastApi {
  push: (text: string, type?: ToastType) => void
}

const ToastCtx = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const TOAST_MS = 3000
const ANIM_MS = 220

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => {
      setToasts((ts) => ts.filter((t) => t.id !== id))
    }, ANIM_MS)
  }, [])

  const push = useCallback(
    (text: string, type: ToastType = 'ok') => {
      const id = nextId.current++
      setToasts((ts) => [...ts, { id, type, text }])
      setTimeout(() => dismiss(id), TOAST_MS)
    },
    [dismiss],
  )

  // Clear toasts on unmount so timers never fire into a dead component tree.
  useEffect(
    () => () => setToasts(() => []),
    [],
  )

  const api = { push }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {createPortal(
        <div className="fixed inset-x-0 bottom-[30vh] z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-lg shadow-ink/10 bg-white text-ink text-sm min-w-[260px] max-w-md ${
                t.leaving ? 'toast-out' : 'toast-in'
              } ${t.type === 'ok' ? 'border-green-200' : 'border-red-200'}`}
            >
              {t.type === 'ok' ? (
                <CircleCheck size={18} className="shrink-0 text-green-600" />
              ) : (
                <CircleAlert size={18} className="shrink-0 text-red-600" />
              )}
              <span className="flex-1 leading-snug">{t.text}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-muted hover:text-ink transition-colors"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}