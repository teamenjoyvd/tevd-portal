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
      event:calendar_events!event_id(id, title, start_time)
    `)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Single-pass: build approvedSet and pendingCountMap together
  const approvedSet = new Set<string>()
  const pendingCountMap = new Map<string, number>()
  for (const r of data ?? []) {
    const key = `${r.event_id}:${r.role_label}`
    if (r.status === 'approved') {
      approvedSet.add(key)
    } else if (r.status === 'pending') {
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
