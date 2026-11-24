import { z } from 'zod'
import { doorStaff } from '@/lib/server/tickets/door'
import { ticketErrorCode } from '@/lib/server/tickets/errors'
import { withFreshCodes } from '@/lib/server/tickets/passes'

const bodySchema = z.object({
  event_id: z.uuid(),
  name: z.string().trim().min(2).max(200),
  email: z.union([z.literal(''), z.email().max(320)]).default(''),
})

/** The SQL function refuses an event without a free product, and a full room. */
export async function POST(req: Request) {
  const staff = await doorStaff()
  if (staff.response) return staff.response
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request', code: 'invalid_input' }, { status: 400 })
  const { event_id, name, email } = parsed.data
  const { error } = await withFreshCodes(({ unlockCode, qrToken }) =>
    staff.supabase.rpc('register_free_admission', {
      p_event_id: event_id,
      p_name: name,
      // Generated types drop SQL nullability; NULL is valid here.
      p_email: (email === '' ? null : email) as string,
      p_profile_id: null as unknown as string,
      p_mode: 'in_person',
      p_admitted_via: 'walk_in',
      p_actor: staff.staffId,
      p_unlock_code: unlockCode,
      p_qr_token: qrToken,
    }),
  )
  if (!error) return Response.json({ admitted: 1 })
  const code = ticketErrorCode(error)
  if (code !== null) return Response.json({ error: 'Not admitted', code }, { status: 409 })
  console.error('[scanner] walk-in', error.code)
  return Response.json({ error: 'Could not admit' }, { status: 500 })
}
