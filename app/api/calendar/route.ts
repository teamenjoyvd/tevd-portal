import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'

export async function GET(req: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')

  // Resolve role for access_roles filtering.
  // Unauthenticated and authenticated-but-no-profile both resolve to 'guest'.
  let role = 'guest'
  try {
    const { userId } = await auth()
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('clerk_id', userId).single()
      if (profile?.role) role = profile.role
    }
  } catch { /* unauthenticated */ }

  let query = supabase
    .from('calendar_events')
    .select('*')
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
    // Agenda: fetch 18 months back through all future events so users
    // can browse past and upcoming events in the same view.
    const eighteenMonthsAgo = new Date()
    eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18)
    query = query.gte('start_time', eighteenMonthsAgo.toISOString())
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
