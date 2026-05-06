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

- [ ] Handler follows the template (validate → auth → logic → respond)
- [ ] Uses `respondSuccess()` / `respondError()` / `respondValidationError()` helpers
- [ ] Correct HTTP status codes (201 for POST, 204 for DELETE, etc.)
- [ ] All inputs validated before processing
- [ ] Auth/permissions checked for protected endpoints
- [ ] `request_id` included in all responses
- [ ] No sensitive data logged (passwords, tokens)
- [ ] `go build ./...` passes locally
- [ ] `go test ./...` passes locally
