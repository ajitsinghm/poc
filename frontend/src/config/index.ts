export const config = {
  api: {
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
    timeout: Number(import.meta.env.VITE_API_TIMEOUT ?? 30_000),
    retryCount: Number(import.meta.env.VITE_REQUEST_RETRY_COUNT ?? 3),
  },
  auth: {
    storageKey: 'auth_token',
  },
}
