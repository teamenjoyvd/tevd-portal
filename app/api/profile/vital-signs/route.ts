import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!profile?.id) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('member_vital_signs')
    .select('id, definition_id, is_active, recorded_at, note, created_at, vital_sign_definitions(category, label, sort_order)')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
