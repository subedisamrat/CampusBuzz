'use client'
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { cacheGet, cacheSet } from '@/lib/client-cache'

interface Options {
  ttl?: number
  refreshInterval?: number
}

export function useCachedData<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: Options = {}
) {
  const { ttl = 30_000, refreshInterval } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  // Hydrate from cache before first paint (client only)
  useLayoutEffect(() => {
    const cached = cacheGet<T>(cacheKey)
    if (cached) {
      setData(cached)
      setLoading(false)
    }
  }, [cacheKey])

  const fetch_ = useCallback(async () => {
    try {
      const result = await fetcher()
      if (mountedRef.current) {
        setData(result)
        setError(null)
        cacheSet(cacheKey, result, ttl)
      }
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message || 'Fetch failed')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [cacheKey, fetcher, ttl])

  useEffect(() => {
    mountedRef.current = true
    if (!cacheGet<T>(cacheKey)) setLoading(true)
    fetch_()
    return () => { mountedRef.current = false }
  }, [fetch_, cacheKey])

  useEffect(() => {
    if (!refreshInterval) return
    const id = setInterval(fetch_, refreshInterval)
    return () => clearInterval(id)
  }, [refreshInterval, fetch_])

  return { data, loading, refetch: fetch_ }
}
