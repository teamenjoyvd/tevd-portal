import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'

export async function GET(req: Request) {
  const { userId } = await auth()
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')

  let query = supabase
    .from('calendar_events')
    .select('*')
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
    // No month param — return all future events (for agenda view)
    query = query.gte('start_time', new Date().toISOString())
  }

  if (!userId) {
    query = query.eq('category', 'N21')
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}