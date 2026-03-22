import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
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
  const { admin_status, admin_note } = body

  if (!admin_status || !['approved', 'rejected'].includes(admin_status)) {
    return Response.json({ error: 'admin_status must be approved or rejected' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('payments')
    .update({ admin_status, admin_note: admin_note ?? null })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
