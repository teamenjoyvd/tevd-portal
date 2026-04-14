import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string; definitionId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: memberId, definitionId } = await params

  const { data, error } = await supabase
    .from('member_vital_signs')
    .update({ is_active: false })
    .eq('profile_id', memberId)
    .eq('definition_id', definitionId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
