import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: trip_id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id, role').eq('clerk_id', userId).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  let query = supabase
    .from('payments')
    .select('id, amount, currency, transaction_date, admin_status, member_status, payment_method, proof_url, note, admin_note, logged_by_admin, created_at')
    .eq('trip_id', trip_id)
    .order('transaction_date', { ascending: false })

  if (profile.role !== 'admin' && profile.role !== 'core') {
    query = query.eq('profile_id', profile.id)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
