import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServiceClient()

  let role = 'guest'
  try {
    const { userId } = await auth()
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('clerk_id', userId).single()
      if (profile?.role) role = profile.role
    }
  } catch { /* unauthenticated */ }

  const { data, error } = await supabase
    .from('guides')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })

  if (!data.access_roles.includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return Response.json(data)
}
