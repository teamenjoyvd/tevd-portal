import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

async function requireAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return null
  return supabase
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('howtos').select('*').eq('id', id).single()
  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json(data)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await requireAdmin()
  if (!supabase) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = ['slug', 'title', 'cover_image_url', 'emoji', 'body', 'access_roles', 'is_published']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await supabase
    .from('howtos').update(update).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await requireAdmin()
  if (!supabase) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('howtos').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
