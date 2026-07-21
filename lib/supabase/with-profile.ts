import { auth } from '@clerk/nextjs/server'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { ensureProfile } from '@/lib/server/ensure-profile'

export type WithProfileResult<T> =
  | { response: Response; userId?: undefined; supabase?: undefined; profile?: undefined; error?: undefined }
  | { response?: undefined; userId: string; supabase: SupabaseClient; profile: T | null; error: PostgrestError | null }

/**
 * Clerk auth (401 if missing) followed by a caller-profile lookup with a
 * per-route column selection. Self-heals a missing profile row: an
 * authenticated user whose Clerk `user.created` webhook has not yet landed
 * (sign-up → request race, or a missed/failed delivery) is given a row on the
 * fly via `ensureProfile` rather than surfacing as `profile: null`. In
 * practice this is a backstop — a new user's first touch is a page render,
 * which self-heals before any client fetch reaches an API route.
 *
 * Usage:
 *   const ctx = await withProfile<{ id: string; role: string }>('id, role')
 *   if (ctx.response) return ctx.response
 *   // ctx.profile is present unless a genuine DB error occurred (check ctx.error)
 */
export async function withProfile<T = { id: string; role: string }>(
  select: string = 'id, role'
): Promise<WithProfileResult<T>> {
  const { userId } = await auth()
  if (!userId) {
    return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const supabase = createServiceClient()
  let { data, error } = await supabase
    .from('profiles')
    .select(select)
    .eq('clerk_id', userId)
    .single()

  // No row and no genuine DB fault (PGRST116 = "no rows") — heal, then re-read.
  if (!data && (!error || error.code === 'PGRST116')) {
    await ensureProfile(userId)
    ;({ data, error } = await supabase
      .from('profiles')
      .select(select)
      .eq('clerk_id', userId)
      .single())
  }

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
