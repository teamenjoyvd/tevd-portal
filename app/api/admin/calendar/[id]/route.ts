import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Invalid or empty request body' }, { status: 400 })
  }

  const allowed = [
    'title', 'description', 'start_time', 'end_time', 'category',
    'event_type', 'meeting_url', 'access_roles', 'available_roles',
    'allow_guest_registration', 'week_number',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No valid fields provided for update' }, { status: 400 })
  }

  // Guard: prevent removing a label that has active (pending/approved) requests.
  // Slot add/remove mechanics are handled atomically by the DB trigger
  // trg_sync_event_role_slots on calendar_events.available_roles.
  if ('available_roles' in update) {
    const newRoles = (update.available_roles as string[]) ?? []

    const { data: currentSlots, error: fetchSlotsError } = await supabase
      .from('event_role_slots')
      .select('role_label')
      .eq('event_id', id)

    if (fetchSlotsError) return Response.json({ error: fetchSlotsError.message }, { status: 500 })

    const existingLabels = new Set((currentSlots ?? []).map(s => s.role_label))
    const newLabels = new Set(newRoles)
    const removedLabels = [...existingLabels].filter(l => !newLabels.has(l))

    if (removedLabels.length > 0) {
      const { data: activeRequests, error: fetchRequestsError } = await supabase
        .from('event_role_requests')
        .select('role_label')
        .eq('event_id', id)
        .in('role_label', removedLabels)
        .in('status', ['pending', 'approved'])

      if (fetchRequestsError) return Response.json({ error: fetchRequestsError.message }, { status: 500 })

      if (activeRequests && activeRequests.length > 0) {
        const blocked = [...new Set(activeRequests.map(r => r.role_label))]
        return Response.json(
          { error: `Cannot remove role(s) with active requests: ${blocked.join(', ')}` },
          { status: 409 }
        )
      }
    }
  }

  const { data, error } = await supabase.from('calendar_events').update(update).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ deleted: true })
}
