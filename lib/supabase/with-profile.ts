import { auth } from '@clerk/nextjs/server'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

export type WithProfileResult<T> =
  | { response: Response; userId?: undefined; supabase?: undefined; profile?: undefined; error?: undefined }
  | { response?: undefined; userId: string; supabase: SupabaseClient; profile: T | null; error: PostgrestError | null }

/**
 * Clerk auth (401 if missing) followed by a caller-profile lookup with a
 * per-route column selection. Does not itself 404 on a missing profile —
 * callers that need that behavior check `profile`/`error` themselves, since
 * a few routes (e.g. app/api/profile/route.ts) distinguish "no row" from a
 * genuine DB error rather than collapsing both to 404.
 *
 * Usage:
 *   const ctx = await withProfile<{ id: string; role: string }>('id, role')
 *   if (ctx.response) return ctx.response
 *   if (!ctx.profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
 */
export async function withProfile<T = { id: string; role: string }>(
  select: string = 'id, role'
): Promise<WithProfileResult<T>> {
  const { userId } = await auth()
  if (!userId) {
    return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(select)
    .eq('clerk_id', userId)
    .single()

  return { userId, supabase, profile: (data as T) ?? null, error }
}

export type RequireAuthResult =
  | { response: Response; userId?: undefined }
  | { response?: undefined; userId: string }

/**
 * Clerk auth only (401 if missing) — no profile lookup. For routes whose
 * ownership/authorization check is folded into a later query (e.g. a
 * `profiles!profile_id!inner(clerk_id)` join) rather than a standalone
 * caller-profile fetch.
 */
export async function requireAuth(): Promise<RequireAuthResult> {
  const { userId } = await auth()
  if (!userId) {
    return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { userId }
}
