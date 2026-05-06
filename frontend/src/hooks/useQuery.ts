import { useState, useEffect, useCallback, useRef } from 'react'
import { SuccessResponse } from '@/types/api'
import { APIError } from '@/lib/errors'
import { config } from '@/config'

interface UseQueryState<T> {
  data: T | null
  error: Error | null
  loading: boolean
  refetch: () => void
}

export function useQuery<T>(
  queryFn: (signal: AbortSignal) => Promise<SuccessResponse<T>>,
  deps: unknown[] = [],
): UseQueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    setLoading(true)
    setError(null)

    const run = async (attempt: number) => {
      try {
        const res = await queryFnRef.current(controller.signal)
        if (!cancelled) {
          setData(res.data)
          setLoading(false)
        }
      } catch (err) {
        if (cancelled) return
        // Don't retry API errors (4xx); only retry network/transient errors
        if (err instanceof APIError || err instanceof DOMException) {
          setError(err as Error)
          setLoading(false)
          return
        }
        if (attempt < config.api.retryCount) {
          // Exponential backoff
          await new Promise((r) => setTimeout(r, 2 ** attempt * 500))
          if (!cancelled) run(attempt + 1)
        } else {
          setError(err as Error)
          setLoading(false)
        }
      }
    }

    run(0)

    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { data, error, loading, refetch }
}
