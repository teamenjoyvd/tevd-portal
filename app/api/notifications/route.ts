import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const countOnly = searchParams.get('count') === 'true'

  if (countOnly) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.id)
      .eq('is_read', false)
      .is('deleted_at', null)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ count: count ?? 0 })
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('profile_id', profile.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.all) return Response.json({ error: 'Bad request' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('clerk_id', userId).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { error } = await supabase
    .from('notifications')
    .update({ deleted_at: new Date().toISOString() })
    .eq('profile_id', profile.id)
    .is('deleted_at', null)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
