import { z } from 'zod'
import { adminCaller, respond } from '@/lib/server/tickets/admin'
import { listAdmissions, listSessions } from '@/lib/server/tickets/admin-views'

/** All ticketed sessions, or one session's admissions with `?event_id=`. */
export async function GET(req: Request) {
  const caller = await adminCaller()
  if (caller.response) return caller.response
  const raw = new URL(req.url).searchParams.get('event_id')
  if (raw === null) return respond(() => listSessions(caller.deps.supabase))
  const id = z.uuid().safeParse(raw)
  if (!id.success) return Response.json({ error: 'Invalid request', code: 'invalid_input' }, { status: 400 })
  return respond(() => listAdmissions(caller.deps.supabase, id.data))
}
