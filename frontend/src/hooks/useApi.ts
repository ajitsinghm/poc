import { useQuery } from '@/hooks/useQuery'
import { apiClient } from '@/lib/api-client'
import { HealthData, TestData, ProfileData, AdminStatsData } from '@/types/api'

export const useHealth = () =>
  useQuery<HealthData>((signal) => apiClient.get('/api/v1/health', signal))

export const useTest = () =>
  useQuery<TestData>((signal) => apiClient.get('/api/v1/test', signal))

export const useProfile = (enabled = true) =>
  useQuery<ProfileData>((signal) => apiClient.get('/api/v1/profile', signal), [enabled])

export const useAdminStats = (enabled = true) =>
  useQuery<AdminStatsData>((signal) => apiClient.get('/api/v1/admin/stats', signal), [enabled])
