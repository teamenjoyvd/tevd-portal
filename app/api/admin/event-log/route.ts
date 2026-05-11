import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'

export type EventLogEntry = {
  id: string
  created_at: string
  actor_id: string
  subject_id: string | null
  event_type: string
  payload: Record<string, unknown>
  status: string
  // Joined from profiles (subject)
  subject_name: string | null
}

const TRACKED_EVENT_TYPES = ['abo_verified', 'abo_verify_failed', 'clerk_sync_failed']

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { data: entries, error } = await supabase
    .from('member_event_log')
    .select('id, created_at, actor_id, subject_id, event_type, payload, status')
    .in('event_type', TRACKED_EVENT_TYPES)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Resolve subject names in a single batch query
  const subjectIds = [...new Set((entries ?? []).map(e => e.subject_id).filter(Boolean))] as string[]

  const nameMap = new Map<string, string>()
  if (subjectIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', subjectIds)

    for (const p of profiles ?? []) {
      nameMap.set(p.id, `${p.first_name} ${p.last_name}`.trim())
    }
  }

  const result: EventLogEntry[] = (entries ?? []).map(e => ({
    ...e,
    payload: (e.payload ?? {}) as Record<string, unknown>,
    subject_name: e.subject_id ? (nameMap.get(e.subject_id) ?? null) : null,
  }))

  return Response.json(result)
}
