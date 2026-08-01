import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerProfile } from '@/lib/supabase/guards'
import { redactForeignProofUrls } from '@/lib/payments/proof'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: trip_id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const profile = await getCallerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  let query = supabase
    .from('payments')
    // profile_id + paid_by_profile_id feed the proof redaction below.
    .select('id, amount, currency, transaction_date, admin_status, member_status, payment_method, proof_url, note, admin_note, logged_by_admin, created_at, profile_id, paid_by_profile_id')
    .eq('trip_id', trip_id)
    .order('transaction_date', { ascending: false })

  const isStaff = profile.role === 'admin' || profile.role === 'core'
  if (!isStaff) {
    query = query.eq('profile_id', profile.id)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Staff are entitled to every proof. A member's own rows now include ones an
  // upline paid for, whose proof object is the payer's — withhold the path from
  // everyone but the payer. See lib/payments/proof.ts.
  if (isStaff) return Response.json(data ?? [])
  return Response.json(redactForeignProofUrls(data ?? [], profile.id))
}
