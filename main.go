package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
)

// APIResponse is the standard API response envelope
type API_Response struct {
	Status    string     `json:"status"` // "success" or "error"
	Data      any        `json:"data,omitempty"`
	Error     *ErrorInfo `json:"error,omitempty"`
	RequestID string     `json:"request_id"`
	Meta      *Metadata  `json:"meta,omitempty"`
}

// ErrorInfo contains structured error information
type ErrorInfo struct {
	Code    string            `json:"code"`    // e.g., "INVALID_INPUT"
	Message string            `json:"message"` // human-readable
	Details string            `json:"details,omitempty"`
	Fields  map[string]string `json:"fields,omitempty"` // field-level errors
}

// Metadata contains response metadata (pagination, counts, etc.)
type Metadata struct {
	Total      int `json:"total,omitempty"`
	Page       int `json:"page,omitempty"`
	PageSize   int `json:"page_size,omitempty"`
	TotalPages int `json:"total_pages,omitempty"`
}

// Claims defines JWT claims structure
type Claims struct {
	UserID    string   `json:"user_id"`
	Email     string   `json:"email"`
	Roles     []string `json:"roles"`
	ExpiresAt int64    `json:"exp"`
}

// requestIDKey is a typed context key for request ID
type contextKey string

const (
	requestIDKey  contextKey = "request_id"
	claimsKey     contextKey = "claims"
	requestIDName string     = "X-Request-ID"
)

// Error codes (constants)
const (
	ErrorCodeInvalidInput     = "INVALID_INPUT"
	ErrorCodeMissingField     = "MISSING_FIELD"
	ErrorCodeUnauthorized     = "UNAUTHORIZED"
	ErrorCodeForbidden        = "FORBIDDEN"
	ErrorCodeNotFound         = "NOT_FOUND"
	ErrorCodeValidationFailed = "VALIDATION_FAILED"
	ErrorCodeInternalError    = "INTERNAL_ERROR"
)

func main() {
	r := chi.NewRouter()

	// Global middleware (order matters)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(requestIDMiddleware)

	// Public routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", HealthCheck)
		r.Get("/test", TestAPI)
	})

	// Protected routes (require authentication)
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(AuthMiddleware)

		r.Get("/profile", GetProfileHandler)
	})

	// Admin-only routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(AuthMiddleware)
		r.Use(RequireRole("admin"))

		r.Get("/admin/stats", GetAdminStatsHandler)
	})

	// Start server with error handling
	log.Printf("Starting server on :8080")
	if err := http.ListenAndServe(":8080", r); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}

// HealthCheck handles GET /api/v1/health
func HealthCheck(w http.ResponseWriter, r *http.Request) {
	respondSuccess(w, r.Context(), http.StatusOK, map[string]any{
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"status":    "running",
	}, nil)
}

// TestAPI handles GET /api/v1/test
func TestAPI(w http.ResponseWriter, r *http.Request) {
	respondSuccess(w, r.Context(), http.StatusOK, map[string]string{
		"env": "development",
	}, nil)
}

// GetProfileHandler handles GET /api/v1/profile (protected)
func GetProfileHandler(w http.ResponseWriter, r *http.Request) {
	claims := getClaimsFromContext(r.Context())
	respondSuccess(w, r.Context(), http.StatusOK, map[string]any{
		"user_id": claims.UserID,
		"email":   claims.Email,
		"roles":   claims.Roles,
	}, nil)
}

// GetAdminStatsHandler handles GET /api/v1/admin/stats (admin only)
func GetAdminStatsHandler(w http.ResponseWriter, r *http.Request) {
	respondSuccess(w, r.Context(), http.StatusOK, map[string]any{
		"total_users":     1250,
		"active_sessions": 89,
		"last_updated":    time.Now().UTC().Format(time.RFC3339),
	}, nil)
}

// requestIDMiddleware adds a unique request ID to each request context
// Checks for X-Request-ID header from client, generates one if missing
func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get(requestIDName)
		if requestID == "" {
			requestID = uuid.New().String()
		}

		ctx := context.WithValue(r.Context(), requestIDKey, requestID)
		w.Header().Set(requestIDName, requestID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// getRequestID retrieves the request ID from context
func getRequestID(ctx context.Context) string {
	id, ok := ctx.Value(requestIDKey).(string)
	if !ok {
		return "unknown"
	}
	return id
}

// respondSuccess sends a successful response with data
func respondSuccess(w http.ResponseWriter, ctx context.Context, statusCode int, data any, meta *Metadata) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(APIResponse{
		Status:    "success",
		Data:      data,
		RequestID: getRequestID(ctx),
		Meta:      meta,
	})
}

// respondError sends an error response with error code and message
func respondError(w http.ResponseWriter, ctx context.Context, statusCode int, errorCode, message, details string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(APIResponse{
		Status:    "error",
		Error:     &ErrorInfo{Code: errorCode, Message: message, Details: details},
		RequestID: getRequestID(ctx),
	})
}

// respondValidationError sends validation errors with field-level details
func respondValidationError(w http.ResponseWriter, ctx context.Context, fieldErrors map[string]string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnprocessableEntity)
	json.NewEncoder(w).Encode(APIResponse{
		Status: "error",
		Error: &ErrorInfo{
			Code:    ErrorCodeValidationFailed,
			Message: "Validation failed",
			Fields:  fieldErrors,
		},
		RequestID: getRequestID(ctx),
	})
}

// getClaimsFromContext retrieves claims from context
func getClaimsFromContext(ctx context.Context) *Claims {
	claims, ok := ctx.Value(claimsKey).(*Claims)
	if !ok {
		return nil
	}
	return claims
}

// AuthMiddleware validates Bearer token in Authorization header
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			respondError(w, r.Context(), http.StatusUnauthorized, ErrorCodeUnauthorized,
				"Missing authorization header", "")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			respondError(w, r.Context(), http.StatusUnauthorized, ErrorCodeUnauthorized,
				"Invalid authorization header format", "Expected 'Bearer <token>'")
			return
		}

		// TODO: Replace with actual token validation
		claims := &Claims{
			UserID: "user-123",
			Email:  "user@example.com",
			Roles:  []string{"user"},
		}

		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole middleware checks if user has required roles
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := getClaimsFromContext(r.Context())
			if claims == nil {
				respondError(w, r.Context(), http.StatusUnauthorized, ErrorCodeUnauthorized,
					"Unauthorized", "")
				return
			}

			hasRole := false
			for _, role := range claims.Roles {
				for _, allowed := range allowedRoles {
					if role == allowed {
						hasRole = true
						break
					}
				}
				if hasRole {
					break
				}
			}

			if !hasRole {
				respondError(w, r.Context(), http.StatusForbidden, ErrorCodeForbidden,
					"Insufficient permissions", "")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
