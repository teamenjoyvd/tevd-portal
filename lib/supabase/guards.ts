import type { SupabaseClient } from '@supabase/supabase-js'

type RequiredRole = 'admin' | 'adminOrCore'

type CallerProfile = { id: string; role: string }
type CallerContext = { profile: CallerProfile; guard: null } | { profile: null; guard: Response }

/**
 * Fetches the caller's profile in a single DB round trip and enforces a role
 * requirement. Returns { profile, guard: null } on success, or { profile: null,
 * guard: Response } (403) when the role check fails.
 *
 * Usage:
 *   const ctx = await getCallerContext(userId, supabase, 'admin')
 *   if (ctx.guard) return ctx.guard
 *   // ctx.profile.id and ctx.profile.role are available here
 */
export async function getCallerContext(
  userId: string,
  supabase: SupabaseClient,
  requiredRole: RequiredRole
): Promise<CallerContext> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()

  const allowed =
    requiredRole === 'admin'
      ? profile?.role === 'admin'
      : profile?.role === 'admin' || profile?.role === 'core'

  if (!profile || !allowed) {
    return { profile: null, guard: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { profile: { id: profile.id, role: profile.role }, guard: null }
}

/**
 * @deprecated Use getCallerContext instead.
 * Returns a 403 Response if the caller is not an admin, null otherwise.
 */
export async function requireAdmin(
  userId: string,
  supabase: SupabaseClient
): Promise<Response | null> {
  const ctx = await getCallerContext(userId, supabase, 'admin')
  return ctx.guard
}

/**
 * @deprecated Use getCallerContext instead.
 * Returns a 403 Response if the caller is neither admin nor core, null otherwise.
 */
export async function requireAdminOrCore(
  userId: string,
  supabase: SupabaseClient
): Promise<Response | null> {
  const ctx = await getCallerContext(userId, supabase, 'adminOrCore')
  return ctx.guard
}
