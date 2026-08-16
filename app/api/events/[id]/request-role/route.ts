import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerProfile } from '@/lib/supabase/guards'
import { isRoleWindowClosed } from '@/lib/events/role-cutoff'

/**
 * Machine-readable failure discriminants (2608-DEV-749), mirroring the
 * AttendFailureCode pattern from /api/events/[id]/attend that the popup already
 * reads via `ApiError.code`. The client switches on these, never on `error`,
 * which is English developer copy.
 */
export type RoleRequestFailureCode =
  | 'role_window_closed'   // past the cutoff, and the caller is not an admin
  | 'already_requested'    // caller already holds a pending/approved row here
  | 'slot_filled'          // somebody else already holds this role
  | 'state_changed'        // the row moved under us between read and write
  | 'nothing_to_cancel'    // no pending/approved row of the caller's to cancel

type SupabaseLike = ReturnType<typeof createServiceClient>

/**
 * Shared gate for POST and DELETE: admins act at any time, everyone else is
 * bound by the 60-minute window. Returns a Response to send, or null to carry
 * on.
 */
async function guardRoleWindow(
  supabase: SupabaseLike,
  eventId: string,
  role: string,
): Promise<Response | null> {
  if (role === 'admin') return null

  const { data: event } = await supabase
    .from('calendar_events')
    .select('start_time')
    .eq('id', eventId)
    .single()

  if (!event) return Response.json({ error: 'Event not found' }, { status: 404 })
  if (isRoleWindowClosed(event.start_time)) {
    return Response.json(
      { error: 'Role sign-ups are closed for this event', code: 'role_window_closed' },
      { status: 403 },
    )
  }
  return null
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: event_id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const profile = await getCallerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Guests cannot request roles
  if (profile.role === 'guest') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const closed = await guardRoleWindow(supabase, event_id, profile.role)
  if (closed) return closed

  const { role_label, note } = await req.json()
  if (!role_label) return Response.json({ error: 'role_label required' }, { status: 400 })

  // Guard: reject if slot is already filled
  const { data: slotRequests, error: slotError } = await supabase
    .from('event_role_requests')
    .select('status')
    .eq('event_id', event_id)
    .eq('role_label', role_label)
    .eq('status', 'approved')
    .maybeSingle()

  if (slotError) return Response.json({ error: slotError.message }, { status: 500 })
  if (slotRequests) {
    return Response.json(
      { error: 'This role is already filled', code: 'slot_filled' },
      { status: 409 },
    )
  }

  // UNIQUE (event_id, profile_id) means one row per member per event, so a
  // member re-requesting after a cancel or a deny has to UPDATE that row rather
  // than insert a second one. Explicit branches, deliberately not a blanket
  // upsert: an upsert would knock an already-approved row back to 'pending'.
  const { data: existing, error: existingError } = await supabase
    .from('event_role_requests')
    .select('id, status')
    .eq('event_id', event_id)
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (existingError) return Response.json({ error: existingError.message }, { status: 500 })

  if (existing) {
    if (existing.status === 'pending' || existing.status === 'approved') {
      return Response.json(
        { error: 'You already have a request for this event', code: 'already_requested' },
        { status: 409 },
      )
    }

    // Revive a denied/cancelled row. The `.in('status', ...)` is a PRECONDITION
    // re-checked at write time, not decoration: `.eq('id', ...)` alone is a
    // read-then-write race that loses data — a member reviving their denied row
    // while an admin approves it would clobber 'approved' back to 'pending',
    // and idx_event_role_requests_one_approved_per_slot would not catch it
    // (it only guards approved-vs-approved).
    const { data: revived, error: reviveError } = await supabase
      .from('event_role_requests')
      .update({
        status: 'pending',
        role_label,
        note: note ?? null,
        cancelled_at: null,
        cancelled_by: null,
      })
      .eq('id', existing.id)
      .in('status', ['denied', 'cancelled'])
      .select()
      .maybeSingle()

    if (reviveError) return Response.json({ error: reviveError.message }, { status: 500 })
    if (!revived) {
      // Zero rows means the state moved under us. Never retry silently.
      return Response.json(
        { error: 'This request changed while you were acting on it', code: 'state_changed' },
        { status: 409 },
      )
    }
    return Response.json(revived, { status: 200 })
  }

  const { data, error } = await supabase
    .from('event_role_requests')
    .insert({ event_id, profile_id: profile.id, role_label, note: note ?? null })
    .select()
    .single()

  if (error) {
    // Unique constraint — a concurrent request beat us to the insert.
    if (error.code === '23505') {
      return Response.json(
        { error: 'You already have a request for this event', code: 'already_requested' },
        { status: 409 },
      )
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}

/**
 * Member self-withdraw — for pending AND approved rows since 2608-DEV-749.
 *
 * The hard DELETE is gone: cancelling is a soft status move, which is what makes
 * the audit trail and the revive branch above coherent. It is also what stopped
 * this route lying — it used to answer `{cancelled: true}` 200 even when its
 * `.eq('status','pending')` filter matched zero rows, so an approved holder saw
 * a success toast and nothing changed.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: event_id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const profile = await getCallerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // The cutoff binds withdrawals too — it was client-only before (`disabledCancel`),
  // so a crafted request could free a slot minutes before the event started.
  const closed = await guardRoleWindow(supabase, event_id, profile.role)
  if (closed) return closed

  // One conditional UPDATE, no read-then-write: the `.in('status', ...)` is the
  // precondition, evaluated at write time. Uniform for pending and approved.
  const { data, error } = await supabase
    .from('event_role_requests')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: profile.id,
    })
    .eq('event_id', event_id)
    .eq('profile_id', profile.id)
    .in('status', ['pending', 'approved'])
    .select('id, status')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) {
    return Response.json(
      { error: 'No active role request to cancel', code: 'nothing_to_cancel' },
      { status: 404 },
    )
  }

  return Response.json({ cancelled: true, id: data.id })
}
