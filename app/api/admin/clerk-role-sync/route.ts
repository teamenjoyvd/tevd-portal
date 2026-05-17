import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/clerk-role-sync
 *
 * Incident recovery route — re-syncs Clerk publicMetadata.role for every
 * primary profile where the DB role is non-guest. Idempotent; safe to call
 * multiple times. Admin-only.
 */
export async function POST(): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('clerk_id, role, first_name, last_name')
    .in('role', ['admin', 'core', 'member'])
    .is('primary_profile_id', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clerk = await clerkClient()
  const results: { clerk_id: string; role: string; status: string }[] = []

  for (const profile of profiles ?? []) {
    try {
      await clerk.users.updateUserMetadata(profile.clerk_id, {
        publicMetadata: { role: profile.role },
      })
      results.push({ clerk_id: profile.clerk_id, role: profile.role, status: 'ok' })
    } catch (e) {
      results.push({
        clerk_id: profile.clerk_id,
        role: profile.role,
        status: `error: ${e instanceof Error ? e.message : String(e)}`,
      })
    }
  }

  const failed = results.filter(r => r.status !== 'ok')
  return NextResponse.json({ synced: results.length, failed: failed.length, results })
}
