// Shared response handling. If the response body doesn't parse as JSON it's
// not a real API response (e.g. an SPA fallback HTML page) — treat it as a
// hard failure instead of a silent success.
async function readBody(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new Error(res.ok ? 'Unexpected response from server' : 'Server error')
  }
}

export async function postJson<T = any>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const data = await readBody(res)
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Request failed')
  }
  return data as T
}

export async function getJson<T = any>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers })
  const data = await readBody(res)
  if (!res.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data as T
}

export async function patchJson<T = any>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const data = await readBody(res)
  if (!res.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data as T
}

export async function putJson<T = any>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const data = await readBody(res)
  if (!res.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data as T
}

export async function delJson<T = any>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers,
  })
  const data = await readBody(res)
  if (!res.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data as T
}
