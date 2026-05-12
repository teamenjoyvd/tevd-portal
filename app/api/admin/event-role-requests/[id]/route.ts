import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

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
      import('@/lib/email/send').then(({ sendNotificationEmail }) => {
        import('@/lib/email/templates/render').then(({ renderEmailTemplate }) => {
          import('@/lib/email/templates/EventRoleRequestEmail').then(({ EventRoleRequestEmail }) => {
            renderEmailTemplate(
              EventRoleRequestEmail({
                firstName: result.profile.first_name || 'Member',
                eventTitle: result.event?.title || 'Event',
                eventDate: result.event?.start_time
                  ? new Date(result.event.start_time).toLocaleDateString()
                  : 'TBD',
                roleLabel: result.role_label,
                status: 'approved',
              })
            ).then(html => {
              sendNotificationEmail({
                to: contactEmail,
                subject: 'Event Role Request Approved ✓',
                html,
                template: 'event_role_request_result',
                meta: { request_id: result.id, profile_id: result.profile_id },
              }).catch(console.error)
            }).catch(console.error)
          }).catch(console.error)
        }).catch(console.error)
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
    import('@/lib/email/send').then(({ sendNotificationEmail }) => {
      import('@/lib/email/templates/render').then(({ renderEmailTemplate }) => {
        import('@/lib/email/templates/EventRoleRequestEmail').then(({ EventRoleRequestEmail }) => {
          renderEmailTemplate(
            EventRoleRequestEmail({
              firstName: profileData.first_name || 'Member',
              eventTitle: eventData?.title || 'Event',
              eventDate: eventData?.start_time
                ? new Date(eventData.start_time).toLocaleDateString()
                : 'TBD',
              roleLabel: data.role_label,
              status: 'denied',
            })
          ).then(html => {
            sendNotificationEmail({
              to: contactEmail,
              subject: 'Event Role Request Declined',
              html,
              template: 'event_role_request_result',
              meta: { request_id: data.id, profile_id: data.profile_id },
            }).catch(console.error)
          }).catch(console.error)
        }).catch(console.error)
      }).catch(console.error)
    }).catch(console.error)
  }

  return Response.json(data)
}
