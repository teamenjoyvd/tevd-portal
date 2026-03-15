import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('quick_links').select('*').order('sort_order')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const { data, error } = await supabase.from('quick_links').insert({
    label:        body.label,
    url:          body.url,
    icon_name:    body.icon_name ?? 'link',
    access_level: body.access_level ?? ['member', 'core', 'admin'],
    sort_order:   body.sort_order ?? 0,
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}