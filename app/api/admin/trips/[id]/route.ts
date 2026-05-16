import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const updateData: { counter_bg_color?: string | null } = {}

  if ('counter_bg_color' in body) {
    const { counter_bg_color } = body as { counter_bg_color?: string | null }
    if (counter_bg_color !== null && !HEX_RE.test(counter_bg_color ?? '')) {
      return Response.json({ error: 'counter_bg_color must be a valid #rrggbb hex string or null' }, { status: 400 })
    }
    updateData.counter_bg_color = counter_bg_color ?? null
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const { data: trip, error } = await supabase
    .from('trips')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(trip)
}
