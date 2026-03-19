import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin' && profile?.role !== 'core') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { status, note } = body

  if (!status || !['completed', 'failed'].includes(status)) {
    return Response.json({ error: 'status must be completed or failed' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('trip_payments')
    .update({ status, note: note ?? null })
    .eq('id', id)
    .eq('submitted_by_member', true)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
