import { createServiceClient } from '@/lib/supabase/service'
import { jwtVerify } from 'jose'
import ical from 'ical-generator'

const secret = new TextEncoder().encode(
  process.env.ICAL_TOKEN_SECRET ?? 'dev-ical-secret-change-in-production'
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return new Response('Missing token', { status: 400 })
  }

  // Verify JWT
  let payload: { profile_id: string; role: string }
  try {
    const { payload: p } = await jwtVerify(token, secret)
    payload = p as { profile_id: string; role: string }
  } catch {
    return new Response('Invalid or expired token', { status: 401 })
  }

  // Verify token matches stored token (allows revocation via regenerate)
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('ical_token')
    .eq('id', payload.profile_id)
    .single()

  if (!profile || profile.ical_token !== token) {
    return new Response('Token revoked', { status: 401 })
  }

  // Fetch events filtered by role
  const { data: events } = await supabase
    .from('calendar_events')
    .select('id, title, description, start_time, end_time, category, location, meeting_url')
    .contains('access_roles', [payload.role])
    .order('start_time')

  // Build iCal — no timezone set so dates are emitted as UTC (DTSTART:...Z)
  // start_time/end_time from Supabase are +00 UTC strings; new Date() preserves that.
  const calendar = ical({
    name: 'teamenjoyVD',
    prodId: { company: 'teamenjoyVD', product: 'tevd-portal' },
  })

  for (const event of events ?? []) {
    calendar.createEvent({
      id: event.id,
      summary: event.title,
      description: event.description ?? undefined,
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      location: event.location ?? undefined,
      url: event.meeting_url ?? undefined,
      categories: event.category ? [{ name: event.category }] : undefined,
    })
  }

  return new Response(calendar.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="teamenjoyvd.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  })
}
