import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body: Partial<{
    caption: string
    thumbnail_url: string
    is_visible: boolean
    is_pinned: boolean
    sort_order: number
  }> = await req.json()

  // Pin swap: use atomic RPC to avoid race condition (ISS-0171)
  if (body.is_pinned === true) {
    const { error: rpcError } = await supabase.rpc('pin_social_post', { p_id: id })
    if (rpcError) {
      return Response.json({ error: rpcError.message }, { status: 409 })
    }
    // Remove is_pinned from the body — already handled by RPC
    const { is_pinned: _removed, ...rest } = body
    if (Object.keys(rest).length === 0) {
      const { data, error } = await supabase
        .from('social_posts').select('*').eq('id', id).single()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json(data)
    }
    const { data, error } = await supabase
      .from('social_posts').update(rest).eq('id', id).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  }

  const { data, error } = await supabase
    .from('social_posts').update(body).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { error } = await supabase.from('social_posts').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
