import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('event_role_requests')
    .select(`
      id,
      role_label,
      status,
      note,
      created_at,
      event_id,
      profile:profiles!profile_id(id, first_name, last_name, abo_number, contact_email),
      event:calendar_events!event_id(id, title, start_time),
      slot:event_role_slots!inner(role_label)
    `)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Compute slot status per request — filled = approved exists for that (event_id, role_label)
  // We need all approved requests to compute status; derive from the same result set
  const approvedSet = new Set(
    (data ?? []).filter(r => r.status === 'approved').map(r => `${r.event_id}:${r.role_label}`)
  )
  const pendingCountMap = new Map<string, number>()
  for (const r of data ?? []) {
    if (r.status === 'pending') {
      const key = `${r.event_id}:${r.role_label}`
      pendingCountMap.set(key, (pendingCountMap.get(key) ?? 0) + 1)
    }
  }

  const enriched = (data ?? []).map(r => {
    const key = `${r.event_id}:${r.role_label}`
    let slot_status: 'open' | 'contested' | 'filled'
    if (approvedSet.has(key)) {
      slot_status = 'filled'
    } else if ((pendingCountMap.get(key) ?? 0) > 0) {
      slot_status = 'contested'
    } else {
      slot_status = 'open'
    }
    return { ...r, slot_status }
  })

  return Response.json(enriched)
}
