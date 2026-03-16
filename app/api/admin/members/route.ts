import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: admin } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (admin?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  // LOS map as base, left-join profiles + tree depth
  const { data: losMembers, error: losErr } = await supabase
    .from('los_members')
    .select(`
      abo_number, sponsor_abo_number, abo_level, name, country,
      gpv, ppv, bonus_percent, group_size, qualified_legs, annual_ppv,
      renewal_date, last_synced_at
    `)
    .order('abo_level')
    .order('abo_number')

  if (losErr) return Response.json({ error: losErr.message }, { status: 500 })

  // Profiles linked by abo_number
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, abo_number, first_name, last_name, role, created_at')
    .not('abo_number', 'is', null)

  // Pending verification requests with profile info
  const { data: verifications } = await supabase
    .from('abo_verification_requests')
    .select('id, profile_id, claimed_abo, claimed_upline_abo, status, created_at, profiles(first_name, last_name)')
    .eq('status', 'pending')

  // Guests with no abo_number and no pending request (unverified, haven't submitted yet)
  const { data: guests } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, created_at')
    .eq('role', 'guest')
    .is('abo_number', null)

  const profilesByAbo = Object.fromEntries((profiles ?? []).map(p => [p.abo_number, p]))

  const enrichedLOS = (losMembers ?? []).map(m => ({
    ...m,
    profile: profilesByAbo[m.abo_number] ?? null,
  }))

  return Response.json({
    los_members: enrichedLOS,
    pending_verifications: verifications ?? [],
    unverified_guests: guests ?? [],
  })
}