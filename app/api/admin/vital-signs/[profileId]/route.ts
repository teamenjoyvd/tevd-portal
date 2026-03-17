import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: caller } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (!caller || !['admin', 'core'].includes(caller.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body: { event_key: string; event_label: string; has_ticket: boolean } = await req.json()

  const { data, error } = await supabase
    .from('member_vital_signs')
    .upsert({
      profile_id:  profileId,
      event_key:   body.event_key,
      event_label: body.event_label,
      has_ticket:  body.has_ticket,
      updated_by:  userId,
    }, { onConflict: 'profile_id,event_key' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
