import { defaultEvent, type StudioEvent } from './constants'

export type { StudioEvent } from './constants'

let cache: StudioEvent | null = null
let cacheAt = 0
const TTL = 15_000

async function get<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function liveFromApi(): Promise<StudioEvent | null> {
  const data = await get<{ event?: StudioEvent }>('/api/events/live')
  return data?.event ?? null
}

export async function fetchLiveEvent(force = false): Promise<StudioEvent> {
  if (!force && cache && Date.now() - cacheAt < TTL) return cache
  const event = await liveFromApi()
  const resolved = event ?? defaultEvent
  cache = resolved
  cacheAt = Date.now()
  return resolved
}

// Returns the real live event, or null when there is none right now (e.g. every
// live event has ended). Used to hide the live-event banners on the homepage.
export async function fetchLiveEventOrNull(): Promise<StudioEvent | null> {
  const event = await liveFromApi()
  if (event) {
    cache = event
    cacheAt = Date.now()
  }
  return event
}

export async function fetchEvents(): Promise<StudioEvent[]> {
  const data = await get<{ events: StudioEvent[] }>('/api/events')
  if (data?.events?.length) return data.events
  return [defaultEvent]
}

export async function fetchEventByKey(key: string): Promise<StudioEvent | null> {
  const res = await get<{ event: StudioEvent }>(`/api/events/${encodeURIComponent(key)}`)
  return res?.event ?? null
}

// Returns the event relevant to the register page: the one requested via the
// `:eventKey` route param or `?event=` query param (id or slug) if given,
// otherwise the live event. Null means nothing to register for right now:
// calling code decides how to surface that (not found / no live event).
export async function resolveRegisterEvent(eventKey?: string | null): Promise<StudioEvent | null> {
  if (eventKey) {
    const found = await fetchEventByKey(eventKey)
    if (found) return found
    return null
  }
  return fetchLiveEventOrNull()
}

export function eventRegisterUrl(event: { slug?: string; id: string }): string {
  const key = event.slug || event.id
  return `/register/${encodeURIComponent(key)}`
}

export function ticketPrice(t: { price: number; originalPrice?: number; promoDeadline?: number }, now = Date.now()): number {
  if (t.promoDeadline && t.originalPrice && now < t.promoDeadline) return t.price
  return t.originalPrice ?? t.price
}

export function ticketPromoActive(t: { price: number; originalPrice?: number; promoDeadline?: number }, now = Date.now()): boolean {
  return Boolean(t.promoDeadline && t.originalPrice && now < t.promoDeadline)
}

export function isEventLive(e: StudioEvent): boolean {
  return e.status === 'live'
}