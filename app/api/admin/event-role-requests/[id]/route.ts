import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

type RoleEmailPayload = {
  contactEmail: string
  firstName: string | null
  eventTitle: string
  eventDate: string
  roleLabel: string
  status: 'approved' | 'denied'
  requestId: string
  profileId: string
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
    subject: payload.status === 'approved' ? 'Event Role Request Approved ✓' : 'Event Role Request Declined',
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
  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { status } = await req.json()
  if (!['approved', 'denied'].includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  if (status === 'approved') {
    // Use the atomic RPC — approves target, denies competing pending requests
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('approve_event_role_request', { p_request_id: id })

    if (rpcError) return Response.json({ error: rpcError.message }, { status: 500 })

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

  // Deny path — direct update, no slot write needed
  const { data, error } = await supabase
    .from('event_role_requests')
    .update({ status: 'denied' })
    .eq('id', id)
    .select('id, role_label, profile_id, profile:profiles!profile_id(first_name, contact_email), event:calendar_events!event_id(title, start_time)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

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
      status: 'denied',
      requestId: data.id,
      profileId: data.profile_id,
    }).catch(console.error)
  }

  return Response.json(data)
}
