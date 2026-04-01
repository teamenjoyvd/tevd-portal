import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns a 403 Response if the caller is not an admin, null otherwise.
 * Usage:
 *   const guard = await requireAdmin(userId, supabase)
 *   if (guard) return guard
 */
export async function requireAdmin(
  userId: string,
  supabase: SupabaseClient
): Promise<Response | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()
  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/**
 * Returns a 403 Response if the caller is neither admin nor core, null otherwise.
 * Usage:
 *   const guard = await requireAdminOrCore(userId, supabase)
 *   if (guard) return guard
 */
export async function requireAdminOrCore(
  userId: string,
  supabase: SupabaseClient
): Promise<Response | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'core') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
