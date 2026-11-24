import { z } from 'zod'
import { doorStaff } from '@/lib/server/tickets/door'
import { redeem } from '@/lib/server/tickets/redeem'
import { createZoomPort } from '@/lib/server/zoom/port'

const bodySchema = z.object({
  event_id: z.uuid(),
  pass_id: z.uuid(),
  via: z.enum(['qr', 'code', 'search']),
  names: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
})

/** The SQL function decides; this adds no rule of its own. */
export async function POST(req: Request) {
  const staff = await doorStaff()
  if (staff.response) return staff.response
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request', code: 'invalid_input' }, { status: 400 })
  const { event_id, pass_id, via, names } = parsed.data
  try {
    const result = await redeem(
      { supabase: staff.supabase, zoom: createZoomPort(staff.supabase) },
      {
        passId: pass_id,
        eventId: event_id,
        attendees: names.map((name) => ({ name })),
        mode: 'in_person',
        admittedVia: via,
        actorId: staff.staffId,
      },
    )
    return result.ok
      ? Response.json({ admitted: result.admissions.length })
      : Response.json({ error: 'Not admitted', code: result.code }, { status: 409 })
  } catch (err) {
    console.error('[scanner] redeem', err instanceof Error ? err.name : 'error')
    return Response.json({ error: 'Could not admit' }, { status: 500 })
  }
}
