import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { diffEventFields, notifyGuestsOfEventUpdate, notifyGuestsOfEventCancellation, type DiffableEvent } from '@/lib/notifications/guest-event-changes'

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
    'allow_guest_registration', 'guest_capacity', 'week_number',
    'reminders_enabled',
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

  // Fetch the pre-update row for the diff-notify below — must happen before
  // the update call so "prev" actually reflects the pre-change state.
  const { data: prevRow, error: prevRowError } = await supabase
    .from('calendar_events')
    .select('start_time, end_time, meeting_url')
    .eq('id', id)
    .single()
  if (prevRowError) console.error('Failed to fetch pre-update event row, skipping guest notify:', prevRowError)

  const { data, error } = await supabase.from('calendar_events').update(update).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Notify active guest registrants of tracked-field changes — fire-and-forget,
  // must not block this response.
  if (prevRow) {
    const nextRow: DiffableEvent = {
      start_time:  data.start_time,
      end_time:    data.end_time,
      meeting_url: data.meeting_url ?? null,
    }
    const changedFields = diffEventFields(prevRow as DiffableEvent, nextRow)
    notifyGuestsOfEventUpdate(id, changedFields)
  }

  return Response.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  // 2608-DEV-764: guest_registrations.event_id is ON DELETE RESTRICT now, so a
  // bare delete raises 23503 the moment the event has any registration —
  // cancelled ones included, because they are kept for stats. Refuse with the
  // count first, and only go through on explicit confirmation.
  const confirmed = new URL(req.url).searchParams.get('deleteRegistrations') === 'true'

  const { count: registrationCount, error: countError } = await supabase
    .from('guest_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
  if (countError) return Response.json({ error: countError.message }, { status: 500 })

  const registrations = registrationCount ?? 0
  if (registrations > 0 && !confirmed) {
    return Response.json(
      {
        error: `This event has ${registrations} registration(s). Deleting it deletes them too — confirm to proceed.`,
        registrationCount: registrations,
        requiresConfirmation: true,
      },
      { status: 409 },
    )
  }

  // Fetch active registrants + event title BEFORE deleting — once the rows are
  // gone there is nothing left to notify from.
  const { data: eventRow, error: eventRowError } = await supabase
    .from('calendar_events')
    .select('title')
    .eq('id', id)
    .single()
  if (eventRowError) console.error('Failed to fetch event title before delete, skipping guest cancel-notify:', eventRowError)

  // Member registrations (2608-DEV-705) carry expires_at NULL — `.gt` alone
  // would treat them as expired and skip them.
  const nowIso = new Date().toISOString()
  const { data: regs, error: regsError } = await supabase
    .from('guest_registrations')
    .select('email, name, lang')
    .eq('event_id', id)
    .is('cancelled_at', null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  if (regsError) console.error('Failed to fetch active registrants before delete, skipping guest cancel-notify:', regsError)

  // With registrations present, both deletes must be one transaction —
  // supabase-js cannot span statements, so the RPC owns it (2608-DEV-764).
  let registrationsDeleted = 0
  if (registrations > 0) {
    const { data: deletedCount, error } = await supabase.rpc('admin_delete_event_with_registrations', {
      p_event_id: id,
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    registrationsDeleted = deletedCount ?? 0
  } else {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  if (eventRow && regs && regs.length > 0) {
    notifyGuestsOfEventCancellation(
      eventRow.title,
      // Member rows have email NULL — notifying them is 2608-DEV-707's job.
      regs.flatMap(r =>
        r.email === null
          ? []
          : [{ email: r.email, name: r.name, lang: (r.lang === 'bg' ? 'bg' : 'en') as 'bg' | 'en' }],
      ),
    )
  }

  return Response.json({ deleted: true, registrationsDeleted })
}
