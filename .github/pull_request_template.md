## Summary

<!-- What does this PR do? Why is it needed? -->

## Changes

<!-- Bullet list of key changes -->
-

## Type of Change

- [ ] Bug fix
- [ ] New feature / endpoint
- [ ] Refactor
- [ ] Docs / config

## Checklist

### Go (Backend)

- [ ] Handler follows the template (validate → auth → logic → respond)
- [ ] Uses `respondSuccess()` / `respondError()` / `respondValidationError()` helpers
- [ ] Correct HTTP status codes (201 for POST, 204 for DELETE, etc.)
- [ ] All inputs validated before processing
- [ ] Auth/permissions checked for protected endpoints
- [ ] `request_id` included in all responses
- [ ] No sensitive data logged (passwords, tokens)
- [ ] `go build ./...` passes locally
- [ ] `go test ./...` passes locally

### React (Frontend)

- [ ] API responses validated against `APIResponse<T>` envelope
- [ ] Error responses handled by `error.code` (not generic messages)
- [ ] Field-level validation errors (`error.fields`) displayed in UI
- [ ] Bearer token included in `Authorization` header for protected endpoints
- [ ] 401 Unauthorized clears token and redirects to login
- [ ] Requests cancelled on component unmount (`AbortController`)
- [ ] No hardcoded API URLs — environment variables used
- [ ] No sensitive data (tokens, passwords) logged
- [ ] Loading states shown during API calls
- [ ] `npm run lint` passes locally
- [ ] `npm run build` passes locally
