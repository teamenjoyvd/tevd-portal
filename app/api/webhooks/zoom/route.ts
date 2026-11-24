import { createHmac, timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_SKEW_S = 300

const urlValidation = z.object({
  event: z.literal('endpoint.url_validation'),
  payload: z.object({ plainToken: z.string().min(1).max(500) }),
})
const participantEvent = z.object({
  event: z.enum(['webinar.participant_joined', 'webinar.participant_left']),
  payload: z.object({
    object: z.object({
      participant: z.object({
        registrant_id: z.string().optional(),
        join_time: z.string().optional(),
        leave_time: z.string().optional(),
      }),
    }),
  }),
})

const hmac = (secret: string, text: string) => createHmac('sha256', secret).update(text).digest('hex')

function signatureValid(secret: string, req: Request, raw: string): boolean {
  const timestamp = req.headers.get('x-zm-request-timestamp') ?? ''
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_S) return false
  const expected = Buffer.from(`v0=${hmac(secret, `v0:${timestamp}:${raw}`)}`)
  const given = Buffer.from(req.headers.get('x-zm-signature') ?? '')
  return expected.length === given.length && timingSafeEqual(expected, given)
}

const validTime = (value: string | undefined): string | null =>
  value !== undefined && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null

/**
 * Presence only. Both writes are conditional, so a redelivery changes nothing
 * and no dedupe table is needed.
 */
export async function POST(req: Request) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN
  if (!secret) return Response.json({ error: 'Not configured' }, { status: 503 })

  const raw = await req.text()
  if (!signatureValid(secret, req, raw)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const validation = urlValidation.safeParse(body)
  if (validation.success) {
    const { plainToken } = validation.data.payload
    return Response.json({ plainToken, encryptedToken: hmac(secret, plainToken) })
  }

  const parsed = participantEvent.safeParse(body)
  if (!parsed.success) return Response.json({ ok: true })
  const { registrant_id: ref, join_time, leave_time } = parsed.data.payload.object.participant
  if (ref === undefined || ref === '') return Response.json({ ok: true })

  const supabase = createServiceClient()
  if (parsed.data.event === 'webinar.participant_joined') {
    const joinedAt = validTime(join_time)
    if (joinedAt === null) return Response.json({ ok: true })
    const first = await supabase
      .from('ticket_admissions')
      .update({ attended_online_at: joinedAt })
      .eq('zoom_ref', ref)
      .is('attended_online_at', null)
    // Back inside: an earlier departure no longer counts towards the grace period.
    const back = await supabase
      .from('ticket_admissions')
      .update({ zoom_left_at: null })
      .eq('zoom_ref', ref)
      .lte('zoom_left_at', joinedAt)
    if (first.error || back.error) return Response.json({ error: 'Retry' }, { status: 500 })
  } else {
    const leftAt = validTime(leave_time)
    if (leftAt === null) return Response.json({ ok: true })
    const { error } = await supabase
      .from('ticket_admissions')
      .update({ zoom_left_at: leftAt })
      .eq('zoom_ref', ref)
      .eq('status', 'active')
      .is('zoom_left_at', null)
    if (error) return Response.json({ error: 'Retry' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
