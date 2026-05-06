// ---------------------------------------------------------------------------
// Standard response envelope – mirrors Go APIResponse struct
// ---------------------------------------------------------------------------

export interface SuccessResponse<T> {
  status: 'success'
  data: T
  request_id: string
  meta?: PaginationMeta
}

export interface ErrorResponse {
  status: 'error'
  error: {
    code: string
    message: string
    details?: string
    fields?: Record<string, string>
  }
  request_id: string
}

export type APIResponse<T> = SuccessResponse<T> | ErrorResponse

export interface PaginationMeta {
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ---------------------------------------------------------------------------
// Domain types – match Go handler response shapes
// ---------------------------------------------------------------------------

export interface HealthData {
  status: string
  timestamp: string
}

export interface TestData {
  env: string
}

export interface ProfileData {
  user_id: string
  email: string
  roles: string[]
}

export interface AdminStatsData {
  total_users: number
  active_sessions: number
  last_updated: string
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isSuccessResponse<T>(r: APIResponse<T>): r is SuccessResponse<T> {
  return r.status === 'success'
}

export function isErrorResponse<T>(r: APIResponse<T>): r is ErrorResponse {
  return r.status === 'error'
}
