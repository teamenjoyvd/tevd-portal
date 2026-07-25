import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { type Profile } from './types'

export function useProfile() {
  return useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => apiClient('/api/profile'),
  })
}
