const CACHE_PREFIX = 'cb_'
const DEFAULT_TTL = 300_000

interface CacheEntry<T> {
  data: T
  ts: number
  ttl: number
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.ts > entry.ttl) {
      sessionStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

export function cacheSet<T>(key: string, data: T, ttl = DEFAULT_TTL) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now(), ttl }))
  } catch {}
}

