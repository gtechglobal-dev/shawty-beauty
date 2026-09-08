import { useEffect, useRef, useState } from 'react'

export type RealtimeEventType =
  | 'hello'
  | 'registrations'
  | 'contacts'
  | 'subscribers'
  | 'sponsors'
  | 'events'
  | 'attendance'
  | 'settings'
  // Synthetic event emitted by the polling fallback (below) — identical
  // handling to the matching data type so pages stay live even where
  // WebSockets are unavailable.
  | 'poll'

export type RealtimeStatus = 'connecting' | 'open' | 'closed'

// Open a WebSocket to the backend's /realtime hub. The URL works both in dev
// (Vite proxies /realtime to the API) and in production (same origin).
function realtimeUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/realtime`
}

export interface RealtimeOptions {
  // When the socket isn't open, emit 'poll' events every pollMs so data still
  // refreshes. Ignored while the socket is connected.
  pollMs?: number
}

// Subscribe to realtime pushes from the backend. Auto-reconnects with a
// capped exponential backoff so the Diary stays live across blips. If
// `pollMs` is set the hook also falls back to timed polling whenever the
// socket is down — this keeps public pages fresh on hosts that don't support
// WebSockets.
export function useRealtime(
  onEvent: (type: RealtimeEventType, payload: unknown) => void,
  opts?: RealtimeOptions,
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const callbackRef = useRef(onEvent)
  callbackRef.current = onEvent
  const pollMs = opts?.pollMs

  useEffect(() => {
    let ws: WebSocket | null = null
    let retries = 0
    let closed = false
    let timer: number | undefined
    let pollTimer: number | undefined
    let openRef = false

    const connect = () => {
      if (closed) return
      setStatus('connecting')
      ws = new WebSocket(realtimeUrl())

      ws.onopen = () => {
        retries = 0
        openRef = true
        setStatus('open')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data))
          if (data && typeof data.type === 'string') {
            callbackRef.current(data.type as RealtimeEventType, data.payload)
          }
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        ws = null
        openRef = false
        if (closed) return
        setStatus('closed')
        retries += 1
        const delay = Math.min(1000 * 2 ** Math.min(retries, 5), 15000)
        timer = window.setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws?.close()
      }
    }

    connect()

    if (pollMs && pollMs > 0) {
      pollTimer = window.setInterval(() => {
        if (!openRef) callbackRef.current('poll', null)
      }, pollMs)
    }

    return () => {
      closed = true
      if (timer) window.clearTimeout(timer)
      if (pollTimer) window.clearInterval(pollTimer)
      ws?.close()
    }
  }, [pollMs])

  return status
}