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

export async function GET(): Promise<Response> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('links').select('*').order('sort_order')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request): Promise<Response> {
  const supabase = await requireAdmin()
  if (!supabase) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>

  // Batch reorder: { items: [{ id, sort_order }] }
  if (Array.isArray(body.items)) {
    const updates = await Promise.all(
      (body.items as { id: string; sort_order: number }[]).map(item =>
        supabase.from('links').update({ sort_order: item.sort_order }).eq('id', item.id)
      )
    )
    const err = updates.find(r => r.error)
    if (err?.error) return Response.json({ error: err.error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  const { data, error } = await supabase.from('links').insert({
    label:        body.label as Record<string, string>,
    url:          body.url as string,
    access_roles: (body.access_roles as string[]) ?? ['guest', 'member', 'core', 'admin'],
    sort_order:   (body.sort_order as number) ?? 0,
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
