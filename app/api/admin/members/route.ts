import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  // LOS map as base, left-join profiles
  const { data: losMembers, error: losErr } = await supabase
    .from('los_members')
    .select(`
      abo_number, sponsor_abo_number, abo_level, name, country,
      gpv, ppv, bonus_percent, group_size, qualified_legs, annual_ppv,
      renewal_date, last_synced_at, entry_date, phone, email, address,
      gbv, customer_pv, ruby_pv, customers, points_to_next_level,
      personal_order_count, group_orders_count, sponsoring
    `)
    .order('abo_level')
    .order('abo_number')

  if (losErr) return Response.json({ error: losErr.message }, { status: 500 })

  // Profiles linked by abo_number
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, abo_number, first_name, last_name, role, primary_profile_id, created_at')
    .not('abo_number', 'is', null)

  const profilesByAbo = Object.fromEntries((profiles ?? []).map(p => [p.abo_number, p]))

  const enrichedLOS = (losMembers ?? []).map(m => ({
    ...m,
    profile: profilesByAbo[m.abo_number] ?? null,
  }))

  return Response.json({ los_members: enrichedLOS })
}
