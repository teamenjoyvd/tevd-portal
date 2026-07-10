import { createServiceClient } from '@/lib/supabase/service'
import { getRoleForAccess } from '@/lib/server/guides'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServiceClient()

  const role = await getRoleForAccess()

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
