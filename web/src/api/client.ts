export function normalizeApiBase(value: string | undefined): string {
  const trimmed = (value ?? '').trim()
  if (!trimmed || trimmed === '/') return ''
  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error(`Unsupported Runtime protocol: ${parsed.protocol}`)
    if (parsed.search || parsed.hash) throw new Error('Runtime apiBase cannot contain a query or fragment')
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed)) throw new Error(`Unsupported Runtime apiBase: ${trimmed}`)
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`
}

export function apiUrl(apiBase: string, path: string): string {
  const base = normalizeApiBase(apiBase)
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

export function websocketUrl(apiBase: string, path: string): string {
  const resolved = new URL(apiUrl(apiBase, path), window.location.href)
  resolved.protocol = resolved.protocol === 'https:' ? 'wss:' : 'ws:'
  return resolved.toString()
}

export async function jsonRequest<T>(apiBase: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(apiBase, path), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
