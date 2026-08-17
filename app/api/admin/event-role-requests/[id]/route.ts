import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

type RoleEmailPayload = {
  contactEmail: string
  firstName: string | null
  eventTitle: string
  eventDate: string
  roleLabel: string
  status: 'approved' | 'denied' | 'cancelled'
  requestId: string
  profileId: string
}

const EMAIL_SUBJECT: Record<RoleEmailPayload['status'], string> = {
  approved:  'Event Role Request Approved ✓',
  denied:    'Event Role Request Declined',
  cancelled: 'Event Role Participation Cancelled',
}

async function sendRoleEmail(payload: RoleEmailPayload): Promise<void> {
  const { sendNotificationEmail } = await import('@/lib/email/send')
  const { renderEmailTemplate } = await import('@/lib/email/templates/render')
  const { EventRoleRequestEmail } = await import('@/lib/email/templates/EventRoleRequestEmail')

  const html = await renderEmailTemplate(
    EventRoleRequestEmail({
      firstName: payload.firstName || 'Member',
      eventTitle: payload.eventTitle,
      eventDate: payload.eventDate,
      roleLabel: payload.roleLabel,
      status: payload.status,
    })
  )

  await sendNotificationEmail({
    to: payload.contactEmail,
    subject: EMAIL_SUBJECT[payload.status],
    html,
    template: 'event_role_request_result',
    meta: { request_id: payload.requestId, profile_id: payload.profileId },
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const { status } = await req.json()
  // 'cancelled' (2608-DEV-749) is the admin revoke: it takes an APPROVED role
  // away and reopens the slot. 'denied' still means "never granted".
  if (!['approved', 'denied', 'cancelled'].includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  if (status === 'approved') {
    // Use the atomic RPC — approves target, denies competing pending requests
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('approve_event_role_request', { p_request_id: id })

    // Log the whole driver error, not just `.message` (2608-DEV-751): a
    // PostgrestError's `code`/`details`/`hint` are what identify an
    // infrastructure fault, and without them a missing column reached the admin
    // as an untraceable generic toast.
    if (rpcError) {
      console.error('[event-role-requests] approve RPC failed:', rpcError)
      return Response.json({ error: rpcError.message }, { status: 500 })
    }

    const result = rpcResult as {
      id: string
      role_label: string
      profile_id: string
      profile: { first_name: string | null; contact_email: string | null }
      event: { title: string; start_time: string }
    }

    const contactEmail = result?.profile?.contact_email
    if (contactEmail) {
      sendRoleEmail({
        contactEmail,
        firstName: result.profile.first_name,
        eventTitle: result.event?.title || 'Event',
        eventDate: result.event?.start_time
          ? new Date(result.event.start_time).toLocaleDateString()
          : 'TBD',
        roleLabel: result.role_label,
        status: 'approved',
        requestId: result.id,
        profileId: result.profile_id,
      }).catch(console.error)
    }

    return Response.json(result)
  }

  // Deny / revoke path — direct update, no slot write needed. Cancelling stamps
  // the audit columns with the acting admin; denying leaves them alone.
  //
  // The `.in('status', ...)` on the revoke is a precondition re-checked at write
  // time: only an APPROVED role can be revoked, and reading-then-writing would
  // let a concurrent change slip through between the two statements.
  const patch = status === 'cancelled'
    ? {
        status: 'cancelled' as const,
        cancelled_at: new Date().toISOString(),
        cancelled_by: ctx.profile.id,
      }
    : { status: 'denied' as const }

  const query = supabase
    .from('event_role_requests')
    .update(patch)
    .eq('id', id)

  if (status === 'cancelled') query.in('status', ['approved'])

  const { data, error } = await query
    .select('id, role_label, profile_id, profile:profiles!profile_id(first_name, contact_email), event:calendar_events!event_id(title, start_time)')
    .maybeSingle()

  if (error) {
    console.error(`[event-role-requests] ${status} update failed:`, error)
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return Response.json(
      { error: 'This request is no longer in a state that can be changed', code: 'state_changed' },
      { status: 409 },
    )
  }

  const profileData = data.profile as { first_name: string | null; contact_email: string | null }
  const eventData = data.event as { title: string; start_time: string }
  const contactEmail = profileData?.contact_email

  if (contactEmail) {
    sendRoleEmail({
      contactEmail,
      firstName: profileData.first_name,
      eventTitle: eventData?.title || 'Event',
      eventDate: eventData?.start_time
        ? new Date(eventData.start_time).toLocaleDateString()
        : 'TBD',
      roleLabel: data.role_label,
      status: status === 'cancelled' ? 'cancelled' : 'denied',
      requestId: data.id,
      profileId: data.profile_id,
    }).catch(console.error)
  }

  return Response.json(data)
}
