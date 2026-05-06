export class APIError extends Error {
  readonly code: string
  readonly fields?: Record<string, string>
  readonly requestId?: string

  constructor(code: string, message: string, fields?: Record<string, string>, requestId?: string) {
    super(message)
    this.name = 'APIError'
    this.code = code
    this.fields = fields
    this.requestId = requestId
  }

  isValidationError(): boolean {
    return this.code === 'VALIDATION_FAILED'
  }

  isUnauthorized(): boolean {
    return this.code === 'UNAUTHORIZED'
  }

  isForbidden(): boolean {
    return this.code === 'FORBIDDEN'
  }

  isNotFound(): boolean {
    return this.code === 'NOT_FOUND'
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message)
    this.name = 'NetworkError'
  }
}
