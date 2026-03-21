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

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('guides')
    .select('id, slug, title, emoji, cover_image_url, access_roles, is_published, created_at, updated_at, sort_order')
    .order('sort_order')
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const supabase = await requireAdmin()
  if (!supabase) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Batch reorder: { items: [{ id, sort_order }] }
  if (Array.isArray(body.items)) {
    const updates = await Promise.all(
      body.items.map((item: { id: string; sort_order: number }) =>
        supabase.from('guides').update({ sort_order: item.sort_order }).eq('id', item.id)
      )
    )
    const err = updates.find(r => r.error)
    if (err?.error) return Response.json({ error: err.error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  const { data, error } = await supabase
    .from('guides')
    .insert({
      slug:            body.slug,
      title:           body.title,
      cover_image_url: body.cover_image_url ?? null,
      emoji:           body.emoji ?? null,
      body:            body.body ?? [],
      access_roles:    body.access_roles ?? ['guest', 'member', 'core', 'admin'],
      is_published:    body.is_published ?? false,
    })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
