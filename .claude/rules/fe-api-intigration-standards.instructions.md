---
name: react-api-integration-standards
description: API integration standards and best practices for React.js frontend development
applyTo: "src/**/*.{ts,tsx}"
---

# React.js API Integration Standards

Production-ready API integration patterns for React.js applications consuming Chi microservice APIs. Enforces consistent request/response handling, error management, authentication, and data fetching patterns.

---

## 1. Response/Request Envelope Handling

### Standard Response Type (TypeScript)

All API responses follow the backend envelope format. Define these types:

```typescript
// src/types/api.ts

// Success response
export interface SuccessResponse<T> {
  status: 'success';
  data: T;
  request_id: string;
}

// Error response
export interface ErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
    details?: string;
    fields?: Record<string, string>;
  };
  request_id: string;
}

// Union type for all responses
export type APIResponse<T> = SuccessResponse<T> | ErrorResponse;

// Generic API response wrapper
export interface PaginatedData<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}
```

### Response Validation

**Always validate response structure:**

```typescript
// src/utils/api-response.ts

export function isSuccessResponse<T>(response: APIResponse<T>): response is SuccessResponse<T> {
  return response.status === 'success' && 'data' in response;
}

export function isErrorResponse(response: any): response is ErrorResponse {
  return response.status === 'error' && response.error;
}

export function getRequestId(response: APIResponse<any>): string {
  return response.request_id;
}
```

---

## 2. API Client Configuration

### Setup with Axios/Fetch

**Recommended: Create a centralized API client:**

```typescript
// src/lib/api-client.ts

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { APIResponse, ErrorResponse, isErrorResponse } from '@/types/api';

class APIClient {
  private client: AxiosInstance;
  private requestId: string = '';

  constructor(baseURL: string = process.env.REACT_APP_API_URL || 'http://localhost:3000') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: Add auth & request ID
    this.client.interceptors.request.use(
      this.addRequestId.bind(this),
      (error) => Promise.reject(error)
    );

    // Response interceptor: Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      this.handleError.bind(this)
    );
  }

  private addRequestId(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    // Generate/use request ID
    this.requestId = config.headers['X-Request-ID'] || uuidv4();
    config.headers['X-Request-ID'] = this.requestId;

    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private handleError(error: any) {
    if (error.response) {
      const errorResponse: ErrorResponse = error.response.data;
      console.error(`[${errorResponse.request_id}] ${errorResponse.error.code}: ${errorResponse.error.message}`);
    }
    return Promise.reject(error);
  }

  async get<T>(url: string, config = {}): Promise<SuccessResponse<T>> {
    const response = await this.client.get<APIResponse<T>>(url, config);
    return this.validateResponse(response.data);
  }

  async post<T>(url: string, data: any, config = {}): Promise<SuccessResponse<T>> {
    const response = await this.client.post<APIResponse<T>>(url, data, config);
    return this.validateResponse(response.data);
  }

  async put<T>(url: string, data: any, config = {}): Promise<SuccessResponse<T>> {
    const response = await this.client.put<APIResponse<T>>(url, data, config);
    return this.validateResponse(response.data);
  }

  async patch<T>(url: string, data: any, config = {}): Promise<SuccessResponse<T>> {
    const response = await this.client.patch<APIResponse<T>>(url, data, config);
    return this.validateResponse(response.data);
  }

  async delete<T>(url: string, config = {}): Promise<SuccessResponse<T | null>> {
    const response = await this.client.delete<APIResponse<T>>(url, config);
    // 204 No Content returns empty body
    if (response.status === 204) {
      return {
        status: 'success',
        data: null as any,
        request_id: this.requestId,
      };
    }
    return this.validateResponse(response.data);
  }

  private validateResponse<T>(response: APIResponse<T>): SuccessResponse<T> {
    if (isErrorResponse(response)) {
      throw new APIError(response.error.code, response.error.message, response.error.fields);
    }
    return response;
  }

  setAuthToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  clearAuthToken(): void {
    localStorage.removeItem('auth_token');
  }
}

export const apiClient = new APIClient();
```

---

## 3. Error Handling

### Custom Error Class

```typescript
// src/lib/errors.ts

export class APIError extends Error {
  code: string;
  fields?: Record<string, string>;
  requestId?: string;

  constructor(code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.fields = fields;
    this.name = 'APIError';
  }

  isValidationError(): boolean {
    return this.code === 'VALIDATION_FAILED';
  }

  isUnauthorized(): boolean {
    return this.code === 'UNAUTHORIZED';
  }

  isForbidden(): boolean {
    return this.code === 'FORBIDDEN';
  }

  isNotFound(): boolean {
    return this.code === 'NOT_FOUND';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}
```

### Error Handling in Components

```typescript
// Example: Component error handling

const [error, setError] = useState<APIError | null>(null);

async function fetchUser(userId: string) {
  try {
    const response = await apiClient.get(`/api/v1/users/${userId}`);
    setUser(response.data);
  } catch (err) {
    if (err instanceof APIError) {
      if (err.isUnauthorized()) {
        // Redirect to login
        apiClient.clearAuthToken();
        window.location.href = '/login';
      } else if (err.isValidationError()) {
        // Show field-level errors
        setError(err);
      } else {
        setError(err);
      }
    } else if (err instanceof NetworkError) {
      setError(new APIError('NETWORK_ERROR', 'Network connection failed'));
    }
  }
}
```

---

## 4. Authentication & Authorization

### JWT Token Management

```typescript
// src/lib/auth.ts

import { apiClient } from './api-client';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    roles: string[];
  };
}

export class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', credentials);
    apiClient.setAuthToken(response.data.token);
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/v1/auth/logout', {});
    } finally {
      apiClient.clearAuthToken();
    }
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.roles?.includes(role) ?? false;
  }

  private getCurrentUser() {
    const userJson = localStorage.getItem('current_user');
    return userJson ? JSON.parse(userJson) : null;
  }
}

export const authService = new AuthService();
```

### Protected Route Component

```typescript
// src/components/ProtectedRoute.tsx

import { Navigate } from 'react-router-dom';
import { authService } from '@/lib/auth';

interface ProtectedRouteProps {
  element: React.ReactElement;
  requiredRole?: string;
}

export function ProtectedRoute({ element, requiredRole }: ProtectedRouteProps) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !authService.hasRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return element;
}
```

---

## 5. Data Fetching Hooks

### Generic useQuery Hook

```typescript
// src/hooks/useQuery.ts

import { useState, useEffect, useCallback } from 'react';
import { APIError, NetworkError, TimeoutError } from '@/lib/errors';
import { SuccessResponse } from '@/types/api';

interface UseQueryOptions {
  enabled?: boolean;
  retry?: number;
  timeout?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface UseQueryState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useQuery<T>(
  queryFn: () => Promise<SuccessResponse<T>>,
  options: UseQueryOptions = {}
): UseQueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const { enabled = true, retry = 3, timeout = 30000, onSuccess, onError } = options;

  const executeQuery = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await queryFn();
        clearTimeout(timeoutId);

        setData(response.data);
        onSuccess?.(response.data);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < retry && !(lastError instanceof APIError)) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    setError(lastError);
    onError?.(lastError);
    setLoading(false);
  }, [queryFn, enabled, retry, timeout, onSuccess, onError]);

  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  return { data, error, loading, refetch: executeQuery };
}
```

### Endpoint-Specific Hooks

```typescript
// src/hooks/useUsers.ts

import { useQuery } from './useQuery';
import { apiClient } from '@/lib/api-client';

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export function useUser(userId: string) {
  return useQuery(() => apiClient.get<User>(`/api/v1/users/${userId}`));
}

export function useUsers(page: number = 1, pageSize: number = 20) {
  return useQuery(() =>
    apiClient.get(`/api/v1/users?page=${page}&page_size=${pageSize}`)
  );
}
```

---

## 6. Mutation Hooks (useMutation)

### Generic useMutation Hook

```typescript
// src/hooks/useMutation.ts

import { useState } from 'react';
import { APIError } from '@/lib/errors';
import { SuccessResponse } from '@/types/api';

interface UseMutationOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseMutationState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<SuccessResponse<TData>>,
  options: UseMutationOptions<TData> = {}
) {
  const [state, setState] = useState<UseMutationState<TData>>({
    data: null,
    error: null,
    loading: false,
  });

  const { onSuccess, onError } = options;

  const mutate = async (variables: TVariables) => {
    setState({ data: null, error: null, loading: true });

    try {
      const response = await mutationFn(variables);
      setState({ data: response.data, error: null, loading: false });
      onSuccess?.(response.data);
      return response.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState({ data: null, error, loading: false });
      onError?.(error);
      throw error;
    }
  };

  return { ...state, mutate };
}
```

### Endpoint-Specific Mutation Hooks

```typescript
// src/hooks/useUserMutations.ts

import { useMutation } from './useMutation';
import { apiClient } from '@/lib/api-client';
import { User } from './useUsers';

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

export function useCreateUser() {
  return useMutation((data: CreateUserRequest) =>
    apiClient.post<User>('/api/v1/users', data)
  );
}

export function useUpdateUser(userId: string) {
  return useMutation((data: UpdateUserRequest) =>
    apiClient.put<User>(`/api/v1/users/${userId}`, data)
  );
}

export function useDeleteUser() {
  return useMutation((userId: string) =>
    apiClient.delete(`/api/v1/users/${userId}`)
  );
}
```

---

## 7. Request ID Tracking & Logging

### Distributed Tracing

```typescript
// src/lib/request-tracking.ts

export class RequestTracker {
  private requestId: string = '';

  generateRequestId(): string {
    this.requestId = this.generateUUID();
    return this.requestId;
  }

  getCurrentRequestId(): string {
    return this.requestId;
  }

  logRequest(method: string, url: string): void {
    console.log(`[${this.requestId}] ${method} ${url}`);
  }

  logResponse(status: number, requestId: string, duration: number): void {
    console.log(`[${requestId}] Response: ${status} (${duration}ms)`);
  }

  logError(error: Error, requestId: string): void {
    console.error(`[${requestId}] Error: ${error.message}`);
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export const requestTracker = new RequestTracker();
```

---

## 8. Request Cancellation

### AbortController Integration

```typescript
// src/hooks/useQueryWithCancel.ts

import { useEffect, useRef } from 'react';

export function useQueryWithCancel<T>(
  queryFn: (signal: AbortSignal) => Promise<T>,
  onSuccess: (data: T) => void,
  onError: (error: Error) => void
) {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    queryFn(signal)
      .then((data) => {
        if (!signal.aborted) {
          onSuccess(data);
        }
      })
      .catch((error) => {
        if (!signal.aborted) {
          onError(error);
        }
      });

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [queryFn, onSuccess, onError]);

  const cancel = () => {
    abortControllerRef.current?.abort();
  };

  return { cancel };
}
```

---

## 9. Caching Strategy

### Simple Cache Implementation

```typescript
// src/lib/cache.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

class Cache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = new Cache();
```

### Using Cache in Hooks

```typescript
// In useQuery hook
const executeQuery = useCallback(async () => {
  const cacheKey = `query_${queryFn.toString()}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData && !skipCache) {
    setData(cachedData);
    setLoading(false);
    return;
  }

  try {
    const response = await queryFn();
    cache.set(cacheKey, response.data);
    setData(response.data);
  } catch (err) {
    setError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    setLoading(false);
  }
}, [queryFn, skipCache]);
```

---

## 10. Form Validation & Submission

### Form Submission Pattern

```typescript
// src/components/UserForm.tsx

import { useState } from 'react';
import { useCreateUser, CreateUserRequest } from '@/hooks/useUserMutations';
import { APIError } from '@/lib/errors';

export function UserForm() {
  const { mutate, loading, error } = useCreateUser();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormErrors({});

    const formData = new FormData(e.currentTarget);
    const request: CreateUserRequest = {
      email: formData.get('email') as string,
      name: formData.get('name') as string,
      password: formData.get('password') as string,
    };

    try {
      await mutate(request);
      // Success - redirect or show success message
    } catch (err) {
      if (err instanceof APIError && err.isValidationError() && err.fields) {
        setFormErrors(err.fields);
      } else {
        setFormErrors({ _error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {formErrors._error && <div className="error">{formErrors._error}</div>}
      
      <input
        name="email"
        type="email"
        placeholder="Email"
        disabled={loading}
        aria-invalid={!!formErrors.email}
      />
      {formErrors.email && <span className="error">{formErrors.email}</span>}

      <input
        name="name"
        type="text"
        placeholder="Name"
        disabled={loading}
        aria-invalid={!!formErrors.name}
      />
      {formErrors.name && <span className="error">{formErrors.name}</span>}

      <input
        name="password"
        type="password"
        placeholder="Password"
        disabled={loading}
        aria-invalid={!!formErrors.password}
      />
      {formErrors.password && <span className="error">{formErrors.password}</span>}

      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}
```

---

## 11. Best Practices

### DO

✅ **Always validate response envelope** before using data
✅ **Handle all error codes** returned by backend
✅ **Include request ID in error logs** for distributed tracing
✅ **Use Bearer token** in Authorization header
✅ **Implement retry logic** with exponential backoff
✅ **Cancel requests** on component unmount
✅ **Cache GET requests** appropriately (user preferences: short TTL)
✅ **Show loading states** during data fetching
✅ **Display field-level validation errors** from API
✅ **Clear token on 401 Unauthorized** and redirect to login
✅ **Use TypeScript interfaces** for all API requests/responses
✅ **Implement pagination** for list endpoints
✅ **Handle 204 No Content** for DELETE responses

### DON'T

❌ **Don't parse raw JSON** without validating structure
❌ **Don't use generic error messages** - parse error.code from response
❌ **Don't expose internal error details** to users
❌ **Don't store sensitive tokens** in localStorage without security measures
❌ **Don't skip validation errors** - display field-level errors
❌ **Don't forget to unsubscribe** from requests on unmount
❌ **Don't cache mutations** (POST, PUT, DELETE)
❌ **Don't retry on 4xx errors** (except 429 rate limit)
❌ **Don't hardcode API URLs** - use environment variables
❌ **Don't make concurrent requests** for same resource (use Request Deduplication)
❌ **Don't ignore request IDs** in logs - they enable distributed tracing

---

## 12. Environment Configuration

### .env.example

```bash
# API Configuration
REACT_APP_API_URL=http://localhost:3000
REACT_APP_API_TIMEOUT=30000
REACT_APP_REQUEST_RETRY_COUNT=3
REACT_APP_CACHE_TTL=300000

# Auth Configuration
REACT_APP_TOKEN_STORAGE_KEY=auth_token
```

### Config Module

```typescript
// src/config/index.ts

export const config = {
  api: {
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
    timeout: parseInt(process.env.REACT_APP_API_TIMEOUT || '30000'),
    retryCount: parseInt(process.env.REACT_APP_REQUEST_RETRY_COUNT || '3'),
  },
  cache: {
    ttl: parseInt(process.env.REACT_APP_CACHE_TTL || '300000'),
  },
  auth: {
    storageKey: process.env.REACT_APP_TOKEN_STORAGE_KEY || 'auth_token',
  },
};
```

---

## 13. Complete Example: Users Feature

### Directory Structure

```
src/
├── components/
│   ├── UserList.tsx
│   ├── UserForm.tsx
│   └── UserDetail.tsx
├── hooks/
│   ├── useQuery.ts
│   ├── useMutation.ts
│   ├── useUsers.ts
│   └── useUserMutations.ts
├── lib/
│   ├── api-client.ts
│   ├── auth.ts
│   ├── errors.ts
│   ├── cache.ts
│   └── request-tracking.ts
├── types/
│   └── api.ts
└── config/
    └── index.ts
```

### UserList Component

```typescript
// src/components/UserList.tsx

import { useState } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { APIError } from '@/lib/errors';

export function UserList() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useUsers(page, 20);

  if (loading) return <div>Loading users...</div>;

  if (error instanceof APIError) {
    if (error.isUnauthorized()) {
      return <div>Please log in to view users</div>;
    }
    return <div>Error: {error.message}</div>;
  }

  if (!data) return <div>No users found</div>;

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.name}</td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>
          Previous
        </button>
        <span>Page {page} of {data.meta.total_pages}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={page === data.meta.total_pages}>
          Next
        </button>
      </div>
    </div>
  );
}
```

---

## 14. Quality Checklist

Before committing any API integration code:

- [ ] All API responses wrapped in `APIResponse<T>` type
- [ ] Error responses checked for `status === 'error'`
- [ ] Field-level validation errors displayed from `error.fields`
- [ ] Request ID extracted and included in logs
- [ ] Bearer token included in Authorization header for protected endpoints
- [ ] 401 Unauthorized triggers logout and redirect to login
- [ ] 403 Forbidden shows permission denied message
- [ ] 404 Not Found handled gracefully (not confused with 400)
- [ ] 422 Unprocessable Entity shows field-level errors
- [ ] Requests cancelled on component unmount (AbortController)
- [ ] GET requests cached appropriately (configurable TTL)
- [ ] POST/PUT/PATCH/DELETE requests NOT cached
- [ ] Retry logic with exponential backoff on network errors
- [ ] Loading states shown during API calls
- [ ] TypeScript interfaces defined for all API request/response bodies
- [ ] Environment variables used for API URL/configuration
- [ ] Request timeout configured (default 30s)
- [ ] 204 No Content responses handled (empty body for DELETE)
- [ ] Pagination implemented for list endpoints (page, page_size, meta)
- [ ] No hardcoded URLs in components - use API client
- [ ] Sensitive data (tokens, passwords) never logged
- [ ] Request ID tracked across the entire request lifecycle
- [ ] Tests written for error scenarios (validation, auth, network)

---

## Related Documentation

- **Backend API Standards**: [chi-api-standards.instructions.md](../rules/chi-api-standards.instructions.md)
- **Behavioral Guidelines**: [CLAUDE.md](../../CLAUDE.md)
- **Project Guide**: [AGENTS.md](../../AGENTS.md)