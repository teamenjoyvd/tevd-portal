import { getRoleForAccess } from '@/lib/server/guides'
import { listEventsForRole } from '@/lib/server/calendar'
import { sofiaMidnightUtc } from '@/lib/calendar-dates'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')

  // Resolve role for access_roles filtering.
  // Unauthenticated and authenticated-but-no-profile both resolve to 'guest'.
  const role = await getRoleForAccess()

  let from: string
  let to: string

  if (month) {
    const [year, monthNum] = month.split('-').map(Number)
    const nextMonth = monthNum === 12 ? 1 : monthNum + 1
    const nextYear = monthNum === 12 ? year + 1 : year
    from = sofiaMidnightUtc(`${month}-01`).toISOString()
    to = sofiaMidnightUtc(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`).toISOString()
  } else {
    // Agenda: bound to a window around today so the view stays cheap while
    // still covering recent past and upcoming events. Must always include
    // today so the Agenda view's scroll-to-today anchor has something to
    // scroll to (see app/(dashboard)/calendar/components/AgendaView.tsx).
    const windowStart = new Date()
    windowStart.setMonth(windowStart.getMonth() - 1)
    const windowEnd = new Date()
    windowEnd.setMonth(windowEnd.getMonth() + 6)
    from = windowStart.toISOString()
    to = windowEnd.toISOString()
  }

  try {
    const data = await listEventsForRole({ role, from, to })
    return Response.json(data, { headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
