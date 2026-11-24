import { z } from 'zod'
import { describePass, doorList, doorStaff, searchPasses } from '@/lib/server/tickets/door'
import { findPass, type TicketPass } from '@/lib/server/tickets/passes'

const bodySchema = z.union([
  z.object({ event_id: z.uuid(), code: z.string().trim().regex(/^[A-Za-z0-9]{8}$/) }),
  z.object({ event_id: z.uuid(), qr: z.string().min(1).max(200) }),
  z.object({ event_id: z.uuid(), pass_id: z.uuid() }),
  z.object({ event_id: z.uuid(), search: z.string().trim().min(3).max(100) }),
])

/** Who is in. */
export async function GET(req: Request) {
  const staff = await doorStaff()
  if (staff.response) return staff.response
  const eventId = z.uuid().safeParse(new URL(req.url).searchParams.get('event_id'))
  if (!eventId.success) return Response.json({ error: 'Invalid request' }, { status: 400 })
  try {
    return Response.json(await doorList(staff.supabase, eventId.data))
  } catch (err) {
    console.error('[scanner] list', err instanceof Error ? err.name : 'error')
    return Response.json({ error: 'Could not load' }, { status: 500 })
  }
}

/** Reads only. POST keeps codes and names out of URLs and logs. */
export async function POST(req: Request) {
  const staff = await doorStaff()
  if (staff.response) return staff.response
  const { supabase } = staff
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request', code: 'invalid_input' }, { status: 400 })
  const body = parsed.data
  try {
    if ('search' in body) return Response.json({ matches: await searchPasses(supabase, body.event_id, body.search) })

    let pass: TicketPass | null
    if ('pass_id' in body) {
      const { data, error } = await supabase.from('ticket_passes').select('*').eq('id', body.pass_id).maybeSingle()
      if (error) throw error
      pass = data
    } else {
      pass = await findPass(supabase, 'code' in body ? { code: body.code } : { qrToken: body.qr })
    }
    const result = pass === null ? null : await describePass(supabase, body.event_id, pass)
    return result === null
      ? Response.json({ error: 'Not found', code: 'not_found' }, { status: 404 })
      : Response.json({ pass: result })
  } catch (err) {
    console.error('[scanner] lookup', err instanceof Error ? err.name : 'error')
    return Response.json({ error: 'Could not load' }, { status: 500 })
  }
}
