import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const page = Math.max(0, Number(searchParams.get('page') ?? '0'))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '20')))
  const status = searchParams.get('status')
  const template = searchParams.get('template')

  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('email_log')
    .select('id, template, recipient, status, error, resend_id, created_at, sent_at, payload', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status && status !== 'all') query = query.eq('status', status)
  if (template && template !== 'all') query = query.eq('template', template)

  const { data, count, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ rows: data ?? [], total: count ?? 0 })
}
