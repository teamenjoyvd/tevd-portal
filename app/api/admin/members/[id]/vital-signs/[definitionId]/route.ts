import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE(
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

  const { error } = await supabase
    .from('member_vital_signs')
    .delete()
    .eq('profile_id', memberId)
    .eq('definition_id', definitionId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
