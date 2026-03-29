import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: Request): Promise<Response> {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') ?? 100)

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
    .from('links')
    .select('id, label, url, access_roles, sort_order')
    .contains('access_roles', [role])
    .order('sort_order')
    .limit(limit)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
