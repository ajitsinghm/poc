# AI Agent Guide: Chi Microservice Project

Quick reference for AI agents working in this codebase. For behavioral guidelines, see [CLAUDE.md](CLAUDE.md).

---

## Project Overview

**Type:** Go HTTP microservice using [Chi router](https://github.com/go-chi/chi)  
**Primary Language:** Go  
**Key Dependencies:** `github.com/go-chi/chi/v5`, `github.com/google/uuid`  
**Database:** PostgreSQL (schema standards [here](.claude/rules/postgresql-schema-standards.instructions.md))

This is a production-ready API microservice with:
- Standard request/response envelopes
- JWT Bearer token authentication
- Role-based access control (RBAC)
- Request ID tracking for distributed tracing
- Comprehensive error handling

---

## Essential Standards

**Before writing any code, read these in order:**

1. **[CLAUDE.md](CLAUDE.md)** - Behavioral guidelines (think before coding, simplicity first, surgical changes)
2. **Backend API:** [.claude/rules/chi-api-standards.instructions.md](.claude/rules/chi-api-standards.instructions.md)
3. **Frontend API:** [.claude/rules/fe-api-intigration-standards.instructions.md](.claude/rules/fe-api-intigration-standards.instructions.md)
4. **Database:** [.claude/rules/postgresql-schema-standards.instructions.md](.claude/rules/postgresql-schema-standards.instructions.md)

---

## Project Structure

```
.
├── main.go                                    # API server (Chi router, middleware, handlers)
├── CLAUDE.md                                  # Behavioral guidelines for AI agents
├── AGENTS.md                                  # This file - AI agent guide
├── .claude/rules/
│   ├── chi-api-standards.instructions.md                 # Backend API pattern enforcement
│   ├── fe-api-intigration-standards.instructions.md      # Frontend API integration standards
│   └── postgresql-schema-standards.instructions.md       # Database design enforcement
└── .github/
    └── copilot-instructions.md                # Karpathy behavioral guidelines
```

---

## Key Patterns

### Request/Response Envelope (Mandatory)

Every endpoint must return the standard envelope:

```go
// Success (200 OK)
{
  "status": "success",
  "data": { /* response payload */ },
  "request_id": "uuid-here"
}

// Error (4xx/5xx)
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "fields": { "field": "error details" }  // Optional
  },
  "request_id": "uuid-here"
}
```

**Use helper functions (already in main.go):**
- `respondSuccess(w, ctx, statusCode, data, meta)` - Success response
- `respondError(w, ctx, statusCode, code, message, details)` - Error response
- `respondValidationError(w, ctx, fieldErrors)` - Validation errors (422)

### Handler Template

Every handler must follow this pattern:

```go
func MyHandler(w http.ResponseWriter, r *http.Request) {
    requestID := getRequestID(r.Context())
    
    // 1. Validate input
    id := chi.URLParam(r, "id")
    if id == "" {
        respondError(w, r.Context(), http.StatusBadRequest, 
            ErrorCodeInvalidInput, "Missing id", "")
        return
    }
    
    // 2. Check auth/permissions (if protected)
    claims := getClaimsFromContext(r.Context())
    if claims == nil {
        respondError(w, r.Context(), http.StatusUnauthorized, 
            ErrorCodeUnauthorized, "Unauthorized", "")
        return
    }
    
    // 3. Execute business logic
    result, err := doSomething(r.Context(), id)
    if err != nil {
        respondError(w, r.Context(), http.StatusInternalServerError, 
            ErrorCodeInternalError, err.Error(), "")
        return
    }
    
    // 4. Return success
    respondSuccess(w, r.Context(), http.StatusOK, result, nil)
}
```

### Route Organization

Routes are organized by protection level in `main()`:

```go
// Public endpoints (no auth required)
r.Route("/api/v1", func(r chi.Router) {
    r.Get("/health", HealthCheck)
    r.Post("/auth/login", LoginHandler)
})

// Protected endpoints (auth required)
r.Route("/api/v1", func(r chi.Router) {
    r.Use(AuthMiddleware)
    r.Get("/profile", GetProfileHandler)
})

// Admin-only endpoints (auth + role check)
r.Route("/api/v1", func(r chi.Router) {
    r.Use(AuthMiddleware)
    r.Use(RequireRole("admin"))
    r.Get("/admin/stats", GetAdminStatsHandler)
})
```

---

## Common Tasks

### Adding a New Public Endpoint

1. Write handler following template above (no auth checks)
2. Register route in public section: `r.Get("/api/v1/resource", ResourceHandler)`
3. Use `respondSuccess()` for 200/201 and `respondError()` for errors
4. Follow [API-STANDARDS.md](API-STANDARDS.md) for request/response format

**Example:** `GET /api/v1/users` (list users)

```go
func ListUsersHandler(w http.ResponseWriter, r *http.Request) {
    requestID := getRequestID(r.Context())
    
    // Fetch users from database
    users, err := getAllUsers(r.Context())
    if err != nil {
        respondError(w, r.Context(), http.StatusInternalServerError, 
            ErrorCodeInternalError, "Failed to fetch users", "")
        return
    }
    
    meta := &Metadata{Total: len(users), Page: 1, PageSize: 20}
    respondSuccess(w, r.Context(), http.StatusOK, users, meta)
}
```

### Adding a Protected Endpoint

1. Add `r.Use(AuthMiddleware)` before route registration
2. Get claims: `claims := getClaimsFromContext(r.Context())`
3. Use claims for authorization checks
4. Follow same response patterns as public endpoints

**Example:** `GET /api/v1/profile` (get current user)

```go
func GetProfileHandler(w http.ResponseWriter, r *http.Request) {
    claims := getClaimsFromContext(r.Context())
    
    respondSuccess(w, r.Context(), http.StatusOK, map[string]any{
        "user_id": claims.UserID,
        "email": claims.Email,
        "roles": claims.Roles,
    }, nil)
}
```

### Adding an Admin-Only Endpoint

1. Add both middlewares: `r.Use(AuthMiddleware)` and `r.Use(RequireRole("admin"))`
2. Admin role is already checked by `RequireRole()` middleware
3. Handle response same way

**Example:** `DELETE /api/v1/users/{id}` (admin deletes user)

```go
func DeleteUserHandler(w http.ResponseWriter, r *http.Request) {
    requestID := getRequestID(r.Context())
    userID := chi.URLParam(r, "id")
    
    if userID == "" {
        respondError(w, r.Context(), http.StatusBadRequest, 
            ErrorCodeInvalidInput, "Missing user ID", "")
        return
    }
    
    if err := deleteUser(r.Context(), userID); err != nil {
        respondError(w, r.Context(), http.StatusInternalServerError, 
            ErrorCodeInternalError, "Failed to delete user", "")
        return
    }
    
    // Return 204 No Content for successful DELETE
    w.WriteHeader(http.StatusNoContent)
}
```

### Validating Request Input

Use struct tags and `ValidateRequest()`:

```go
type CreateUserRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Name     string `json:"name" validate:"required,min=2,max=255"`
    Password string `json:"password" validate:"required,min=8"`
}

func CreateUserHandler(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondError(w, r.Context(), http.StatusBadRequest, 
            ErrorCodeInvalidFormat, "Invalid request body", "")
        return
    }
    
    // Validate
    fieldErrors := ValidateRequest(req)
    if len(fieldErrors) > 0 {
        respondValidationError(w, r.Context(), fieldErrors)
        return
    }
    
    // Process...
}
```

### Error Response Reference

| Status | Code | When to Use | Example |
|--------|------|-----------|---------|
| 400 | `INVALID_INPUT` | Bad request format/validation | Missing required field |
| 401 | `UNAUTHORIZED` | Missing/invalid auth token | No Authorization header |
| 403 | `FORBIDDEN` | Insufficient permissions | User not in admin role |
| 404 | `NOT_FOUND` | Resource doesn't exist | User ID not found |
| 422 | `VALIDATION_FAILED` | Field-level validation errors | Email format invalid |
| 500 | `INTERNAL_ERROR` | Server error | Database connection failed |

---

## Database Schema

See [.claude/rules/postgresql-schema-standards.instructions.md](.claude/rules/postgresql-schema-standards.instructions.md) for:
- Naming conventions (snake_case)
- UUID vs BIGSERIAL decision
- Audit fields (created_at, updated_at, deleted_at)
- Indexing strategy
- Security (roles, RLS)
- Example: Users & Orders schema

**Key rule:** Use `TIMESTAMP WITH TIME ZONE` for all timestamps, `DECIMAL(12,2)` for money, UUID for public IDs.

---

## Authentication

### Request

```http
GET /api/v1/profile HTTP/1.1
Authorization: Bearer <jwt_token>
X-Request-ID: 123e4567-e89b-12d3-a456-426614174000
```

### Current Implementation

`AuthMiddleware` validates Bearer token (TODO: integrate real JWT validation):

```go
// Extracts token from "Authorization: Bearer <token>"
// Stores claims in context
// Public endpoints: don't use AuthMiddleware
// Protected endpoints: use AuthMiddleware
// Admin endpoints: use AuthMiddleware + RequireRole("admin")
```

### Next Steps

1. Implement `ValidateToken()` function (currently a placeholder)
2. Integrate with your JWT library (e.g., `github.com/golang-jwt/jwt`)
3. Validate signature and expiration

---

## Code Quality Rules

**Never:**
- ❌ Return raw data without `APIResponse` envelope
- ❌ Use generic error messages like "error occurred"
- ❌ Omit request IDs from responses
- ❌ Skip input validation
- ❌ Expose internal stack traces in responses
- ❌ Log sensitive data (passwords, tokens)
- ❌ Mix response formats between endpoints

**Always:**
- ✅ Use helper functions: `respondSuccess()`, `respondError()`, `respondValidationError()`
- ✅ Include error codes in all error responses
- ✅ Extract and pass request ID from context
- ✅ Validate UUIDs when used in paths
- ✅ Check permissions before returning sensitive data
- ✅ Use `TIMESTAMP WITH TIME ZONE` for all database timestamps
- ✅ Use `UUID` for public resource IDs
- ✅ Return 204 No Content for successful DELETE (not 200)
- ✅ Return 201 Created for POST that creates resource (not 200)

---

## Testing

When adding a new handler:

1. **Test valid case**: Happy path with correct input → 200/201/204
2. **Test validation**: Missing/invalid input → 400/422 with error code
3. **Test auth**: Missing token → 401 `UNAUTHORIZED`
4. **Test permissions**: Wrong role → 403 `FORBIDDEN`
5. **Test not found**: Resource doesn't exist → 404 `NOT_FOUND`

**Verify response envelope:**
- ✅ Has `status` field ("success" or "error")
- ✅ Has `request_id` field
- ✅ Error responses have `error.code` and `error.message`
- ✅ Error responses may have `error.fields` (validation)

---

## Before You Code

Follow these in order:

1. **Read Karpathy guidelines** ([CLAUDE.md](CLAUDE.md))
   - Think before coding
   - Surface assumptions
   - Simplicity first
   
2. **Check backend API standards** ([.claude/rules/chi-api-standards.instructions.md](.claude/rules/chi-api-standards.instructions.md))
   - Response format
   - Status codes
   - Error codes
   
3. **Check frontend API standards** ([.claude/rules/fe-api-intigration-standards.instructions.md](.claude/rules/fe-api-intigration-standards.instructions.md))
   - API client setup
   - Error handling
   - Authentication
   
4. **Review existing handler** in [main.go](main.go)
   - Pattern for request/response
   - How to use helpers
   - Route organization

5. **Apply template** from "Handler Template" section above
   - Validate input
   - Check auth
   - Execute logic
   - Return response

6. **Verify** against checklist at end of this file

---

## Quick Checklist for New Endpoints

- [ ] Handler follows template pattern (validate → auth → logic → respond)
- [ ] Uses `respondSuccess()` or `respondError()` helpers
- [ ] Returns correct HTTP status (200, 201, 204, 400, 401, 403, 404, 422, 500)
- [ ] Includes error code (e.g., `INVALID_INPUT`, `UNAUTHORIZED`)
- [ ] Validates all inputs before processing
- [ ] Checks authentication/permissions if protected
- [ ] Returns `APIResponse` envelope (status, data/error, request_id)
- [ ] Never omits request_id from response
- [ ] Never exposes internal errors/stack traces
- [ ] Follows naming conventions (snake_case URLs, lowercase HTTP methods)
- [ ] Is registered in correct section (public/protected/admin)
- [ ] Has request_id in error logs for tracing

---

## Useful Commands (When Available)

```bash
# Start server (TODO: add to tasks.json)
go run main.go

# Run tests (TODO: create tests)
go test ./...

# Format code
go fmt ./...

# Lint
golangci-lint run

# Build
go build -o api-server main.go
```

---

## Related Documentation

- **Backend API Standards**: [.claude/rules/chi-api-standards.instructions.md](.claude/rules/chi-api-standards.instructions.md)
- **Frontend API Integration**: [.claude/rules/fe-api-intigration-standards.instructions.md](.claude/rules/fe-api-intigration-standards.instructions.md)
- **Database Schema Standards**: [.claude/rules/postgresql-schema-standards.instructions.md](.claude/rules/postgresql-schema-standards.instructions.md)
- **Behavioral Guidelines**: [CLAUDE.md](CLAUDE.md)
- **Karpathy Guidelines**: [.github/copilot-instructions.md](.github/copilot-instructions.md)

---

## Need Help?

For questions about:
- **Backend API design** → See [.claude/rules/chi-api-standards.instructions.md](.claude/rules/chi-api-standards.instructions.md)
- **Frontend API integration** → See [.claude/rules/fe-api-intigration-standards.instructions.md](.claude/rules/fe-api-intigration-standards.instructions.md)
- **How to write handlers** → See "Handler Template" above
- **Code quality** → See [CLAUDE.md](CLAUDE.md)
- **Database schema** → See [.claude/rules/postgresql-schema-standards.instructions.md](.claude/rules/postgresql-schema-standards.instructions.md)
- **Specific error codes** → See "Error Response Reference" table above
