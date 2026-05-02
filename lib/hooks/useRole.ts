import { useUser } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'

/**
 * Returns the signed-in user's role from Supabase `profiles.role`.
 *
 * - Returns `undefined`  if the user is signed out.
 * - Returns `'guest'`    while loading (optimistic — prevents nav flicker).
 * - Returns `data.role ?? 'guest'` once the fetch resolves.
 *
 * staleTime: 5 min — role changes are infrequent; avoids redundant
 * fetches on every nav render without sacrificing correctness.
 */
export function useRole(): string | undefined {
  const { isSignedIn } = useUser()

  const { data } = useQuery<{ role: string }>({
    queryKey: ['role'],
    queryFn: () => apiClient<{ role: string }>('/api/profile/role'),
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
  })

  if (!isSignedIn) return undefined
  return data?.role ?? 'guest'
}
