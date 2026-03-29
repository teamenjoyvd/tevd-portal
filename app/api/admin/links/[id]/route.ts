import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

async function requireAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  return profile?.role === 'admin' ? supabase : null
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const supabase = await requireAdmin()
  if (!supabase) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json() as Record<string, unknown>
  const { data, error } = await supabase
    .from('links').update(body).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const supabase = await requireAdmin()
  if (!supabase) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { error } = await supabase.from('links').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ deleted: true })
}
