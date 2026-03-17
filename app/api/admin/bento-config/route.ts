import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('bento_config')
    .select('tile_key, max_items')
    .order('tile_key')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body: { tile_key: string; max_items: number }[] = await req.json()
  if (!Array.isArray(body)) return Response.json({ error: 'Expected array' }, { status: 400 })

  const results = await Promise.all(
    body.map(({ tile_key, max_items }) =>
      supabase
        .from('bento_config')
        .update({ max_items })
        .eq('tile_key', tile_key)
        .select()
        .single()
    )
  )

  const errors = results.filter(r => r.error)
  if (errors.length > 0) return Response.json({ error: errors[0].error?.message }, { status: 500 })
  return Response.json(results.map(r => r.data))
}
