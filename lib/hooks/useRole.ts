import { useUser } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { apiClient, ApiError } from '@/lib/apiClient'

/**
 * Returns the signed-in user's role from Supabase `profiles.role`.
 *
 * - Returns `undefined`  if the user is signed out.
 * - Returns `'guest'`    while loading (optimistic — prevents nav flicker).
 * - Returns `data.role ?? 'guest'` once the fetch resolves.
 *
 * queryKey includes user.id to isolate cache per user — prevents stale role
 * bleed when a different account signs in without a full page reload.
 *
 * retry: 404 is not retried (new users without a profile row hit this
 * immediately; retrying adds ~7 s of backoff before settling on 'guest').
 *
 * staleTime: 5 min — role changes are infrequent; avoids redundant
 * fetches on every nav render without sacrificing correctness.
 */
export function useRole(): string | undefined {
  const { user, isSignedIn } = useUser()

  const { data } = useQuery<{ role: string }>({
    queryKey: ['role', user?.id],
    queryFn: () => apiClient<{ role: string }>('/api/profile/role'),
    enabled: !!isSignedIn && !!user?.id,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false
      return failureCount < 3
    },
  })

  if (!isSignedIn) return undefined
  return data?.role ?? 'guest'
}
