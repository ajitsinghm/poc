import { apiClient } from '@/lib/api-client'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    id: string
    email: string
    roles: string[]
  }
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>('/api/v1/auth/login', credentials)
    apiClient.setToken(res.data.token)
    localStorage.setItem('current_user', JSON.stringify(res.data.user))
    return res.data
  },

  logout(): void {
    apiClient.clearToken()
    localStorage.removeItem('current_user')
  },

  isAuthenticated(): boolean {
    return apiClient.getToken() !== null
  },

  getCurrentUser(): LoginResponse['user'] | null {
    const raw = localStorage.getItem('current_user')
    return raw ? (JSON.parse(raw) as LoginResponse['user']) : null
  },

  hasRole(role: string): boolean {
    return this.getCurrentUser()?.roles.includes(role) ?? false
  },
}
