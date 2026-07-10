import { createServiceClient } from '@/lib/supabase/service'
import { getRoleForAccess } from '@/lib/server/guides'

const AGENDA_COLUMNS = 'id, title, description, start_time, end_time, category, event_type, week_number, access_roles, is_all_day'

export async function GET(req: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')

  // Resolve role for access_roles filtering.
  // Unauthenticated and authenticated-but-no-profile both resolve to 'guest'.
  const role = await getRoleForAccess()

  let query = supabase
    .from('calendar_events')
    .select(AGENDA_COLUMNS)
    .contains('access_roles', [role])
    .order('start_time')

  if (month) {
    const start = new Date(`${month}-01`).toISOString()
    const end = new Date(
      new Date(`${month}-01`).getFullYear(),
      new Date(`${month}-01`).getMonth() + 1,
      1
    ).toISOString()
    query = query.gte('start_time', start).lt('start_time', end)
  } else {
    // Agenda: bound to a window around today so the view stays cheap while
    // still covering recent past and upcoming events. Must always include
    // today so the Agenda view's scroll-to-today anchor has something to
    // scroll to (see app/(dashboard)/calendar/components/AgendaView.tsx).
    const windowStart = new Date()
    windowStart.setMonth(windowStart.getMonth() - 1)
    const windowEnd = new Date()
    windowEnd.setMonth(windowEnd.getMonth() + 6)
    query = query.gte('start_time', windowStart.toISOString()).lt('start_time', windowEnd.toISOString())
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
