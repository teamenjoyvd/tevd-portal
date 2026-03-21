import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')

  let query = supabase
    .from('payments')
    .select('id, amount, transaction_date, status, payment_method, proof_url, note, admin_note, submitted_by_member, created_at, profiles(first_name, last_name, abo_number), payable_items(title, item_type, currency)')
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
