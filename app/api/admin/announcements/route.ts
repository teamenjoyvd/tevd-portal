import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('announcements').select('*').order('sort_order').order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const body = await req.json()

  // Batch reorder: { items: [{ id, sort_order }] }
  if (Array.isArray(body.items)) {
    const updates = await Promise.all(
      body.items.map((item: { id: string; sort_order: number }) =>
        supabase.from('announcements').update({ sort_order: item.sort_order }).eq('id', item.id)
      )
    )
    const err = updates.find(r => r.error)
    if (err?.error) return Response.json({ error: err.error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  const { data, error } = await supabase.from('announcements').insert({
    titles:       body.titles,
    contents:     body.contents,
    access_roles: body.access_roles ?? ['member', 'core', 'admin'],
    is_active:    body.is_active ?? true,
    slug:         body.slug ?? null,
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
