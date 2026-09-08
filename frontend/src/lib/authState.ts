const AUTH_TOKEN_KEY = 'sbs_admin_token'

type Listener = () => void

const listeners = new Set<Listener>()

export function isLoggedIn(): boolean {
  return Boolean(localStorage.getItem(AUTH_TOKEN_KEY))
}

// Register a listener fired whenever the admin auth state changes (login or
// logout), so UI like the Navbar badge can react without a page reload.
export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyAuth(): void {
  for (const listener of listeners) listener()
}

export function storeAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  notifyAuth()
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  notifyAuth()
}