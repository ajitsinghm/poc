import { config } from '@/config'
import { APIResponse, SuccessResponse, isErrorResponse } from '@/types/api'
import { APIError, NetworkError } from '@/lib/errors'

function generateRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getAuthToken(): string | null {
  return localStorage.getItem(config.auth.storageKey)
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-ID': generateRequestId(),
    ...extra,
  }
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function parseResponse<T>(res: Response): Promise<SuccessResponse<T>> {
  // 204 No Content – DELETE success
  if (res.status === 204) {
    return { status: 'success', data: null as T, request_id: res.headers.get('X-Request-ID') ?? '' }
  }

  const body: APIResponse<T> = await res.json()

  if (isErrorResponse(body)) {
    throw new APIError(body.error.code, body.error.message, body.error.fields, body.request_id)
  }

  return body
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; signal?: AbortSignal } = {},
): Promise<SuccessResponse<T>> {
  const url = `${config.api.baseURL}${path}`
  try {
    const res = await fetch(url, {
      method,
      headers: buildHeaders(),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
    return parseResponse<T>(res)
  } catch (err) {
    if (err instanceof APIError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new NetworkError((err as Error).message)
  }
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) =>
    request<T>('GET', path, { signal }),

  post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>('POST', path, { body, signal }),

  put: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>('PUT', path, { body, signal }),

  patch: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>('PATCH', path, { body, signal }),

  delete: <T>(path: string, signal?: AbortSignal) =>
    request<T>('DELETE', path, { signal }),

  setToken: (token: string) => localStorage.setItem(config.auth.storageKey, token),
  clearToken: () => localStorage.removeItem(config.auth.storageKey),
  getToken: () => getAuthToken(),
}
