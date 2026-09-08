import { useEffect, useRef, useState } from 'react'

export type RealtimeEventType =
  | 'hello'
  | 'registrations'
  | 'contacts'
  | 'subscribers'
  | 'sponsors'
  | 'events'
  | 'attendance'

export type RealtimeStatus = 'connecting' | 'open' | 'closed'

// Open a WebSocket to the backend's /realtime hub. The URL works both in dev
// (Vite proxies /realtime to the API) and in production (same origin).
function realtimeUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/realtime`
}

// Subscribe to realtime pushes from the backend. Auto-reconnects with a
// capped exponential backoff so the Diary stays live across blips.
export function useRealtime(onEvent: (type: RealtimeEventType, payload: unknown) => void): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const callbackRef = useRef(onEvent)
  callbackRef.current = onEvent

  useEffect(() => {
    let ws: WebSocket | null = null
    let retries = 0
    let closed = false
    let timer: number | undefined

    const connect = () => {
      if (closed) return
      setStatus('connecting')
      ws = new WebSocket(realtimeUrl())

      ws.onopen = () => {
        retries = 0
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

    return () => {
      closed = true
      if (timer) window.clearTimeout(timer)
      ws?.close()
    }
  }, [])

  return status
}