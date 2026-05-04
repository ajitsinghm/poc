---
name: chi-api-standards
description: API standards and best practices for Chi microservice development
applyTo: **/*.go
---

# Chi Microservice API Standards Instructions

These instructions enforce consistent API design, error handling, and authentication patterns across the Chi microservice project.

## Request/Response Envelope

**Always use the standard `APIResponse` envelope:**
- Success responses: `{"status": "success", "data": {...}, "request_id": "..."}`
- Error responses: `{"status": "error", "error": {"code": "...", "message": "..."}, "request_id": "..."}`
- Every response includes a `request_id` for tracking
- Use predefined error codes (`INVALID_INPUT`, `UNAUTHORIZED`, `NOT_FOUND`, etc.)

**Never:**
- Return raw data without the envelope
- Use generic error messages like "error occurred"
- Omit request IDs from responses

## HTTP Status Codes

**Use correct status codes consistently:**
- `200 OK` - Successful GET, PUT, PATCH
- `201 Created` - Successful POST creating a resource
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Invalid input, validation failure
- `401 Unauthorized` - Missing/invalid authentication
- `403 Forbidden` - Authenticated but lacks permission
- `404 Not Found` - Resource doesn't exist
- `422 Unprocessable Entity` - Validation errors
- `500 Internal Server Error` - Unexpected server failure

## Error Handling

**Error responses must include:**
1. `code` - Machine-readable error code (e.g., `INVALID_INPUT`)
2. `message` - Human-readable message
3. `details` (optional) - Additional context or field-level errors
4. `fields` (optional) - Field-level validation errors as map

**Example validation error:**
```json
{
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "fields": {
    "email": "validation failed on 'email' tag",
    "password": "validation failed on 'min' tag"
  }
}
```

## Authentication

**Protected endpoints must use JWT Bearer tokens:**
- Extract token from `Authorization: Bearer <token>` header
- Validate token before processing request
- Store claims in context for downstream access
- Use `GetClaimsFromContext()` to retrieve claims

**Authentication middleware pattern:**
```go
r.Group(func(r chi.Router) {
    r.Use(AuthMiddleware)
    r.Get("/protected-endpoint", ProtectedHandler)
})
```

## Role-Based Access Control (RBAC)

**Use `RequireRole()` middleware for admin/protected actions:**
```go
r.Group(func(r chi.Router) {
    r.Use(AuthMiddleware)
    r.Use(RequireRole("admin"))
    r.Delete("/users/{id}", DeleteUserHandler)
})
```

**Never:** Allow sensitive operations without explicit role checks.

## Request/Response ID Tracking

**Every request must have a unique request ID:**
- Use `X-Request-ID` header if provided by client
- Generate UUID if not provided
- Include request ID in all responses (header + JSON body)
- Log request ID for distributed tracing

## API Versioning

**Use URL path versioning:**
- `/api/v1/...` for version 1
- `/api/v2/...` for version 2 (breaking changes)
- Never skip versions; maintain backward compatibility where possible

## Request Validation

**Validate all inputs before processing:**
- Use struct tags with validator (e.g., `validate:"required,email"`)
- Return field-level errors in error response
- Use HTTP 422 for validation failures

**Validation pattern:**
```go
var fieldErrors = ValidateRequest(req)
if len(fieldErrors) > 0 {
    RespondValidationError(w, requestID, fieldErrors)
    return
}
```

## Pagination

**Implement pagination for list endpoints:**
- Accept `page` and `page_size` query parameters
- Enforce `page_size` max of 100 items
- Return pagination metadata in response:
  ```json
  "meta": {
    "total": 500,
    "page": 1,
    "page_size": 20,
    "total_pages": 25
  }
  ```

## Common Headers

**Request headers to support:**
- `Authorization: Bearer <token>` - JWT authentication
- `X-Request-ID: <uuid>` - Optional request ID override
- `X-Correlation-ID: <uuid>` - Distributed tracing

**Response headers to include:**
- `Content-Type: application/json`
- `X-Request-ID: <uuid>` - Echo the request ID
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` - Rate limit info

## Handler Implementation Template

Every handler should follow this pattern:

1. Extract request ID from context
2. Validate input (path params, request body)
3. Check authentication/authorization (if needed)
4. Execute business logic
5. Return response using helper functions:
   - `RespondSuccess(w, status, data, requestID, meta)`
   - `RespondError(w, status, code, message, details, requestID)`
   - `RespondValidationError(w, requestID, fieldErrors)`

```go
func MyHandler(w http.ResponseWriter, r *http.Request) {
    requestID := getRequestID(r.Context())
    
    // Validation
    id := chi.URLParam(r, "id")
    if id == "" {
        RespondError(w, http.StatusBadRequest, ErrorCodeInvalidInput, 
            "Missing id", "", requestID)
        return
    }
    
    // Business logic
    result, err := doSomething(r.Context(), id)
    if err != nil {
        RespondError(w, http.StatusInternalServerError, 
            ErrorCodeInternalError, err.Error(), "", requestID)
        return
    }
    
    // Success
    RespondSuccess(w, http.StatusOK, result, requestID, nil)
}
```

## Code Quality Rules

**Never:**
- Return unstructured error messages
- Expose internal stack traces in responses
- Log sensitive data (passwords, tokens)
- Skip input validation
- Use different response formats for different endpoints
- Omit request tracking information
- Mix authenticated and public endpoints without clear separation

**Always:**
- Use the response helper functions
- Include error codes in error responses
- Validate UUIDs when used in paths
- Check permissions before returning sensitive data
- Use context for request-scoped values
- Log request/response for debugging (with request ID)

## Response Examples Quick Reference

**Success (200 OK):**
```json
{
  "status": "success",
  "data": { "id": "...", "name": "..." },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation Error (422):**
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "fields": { "email": "invalid" }
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Unauthorized (401):**
```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing authorization header"
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Not Found (404):**
```json
{
  "status": "error",
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

