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
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { status } = await req.json()
  if (!['approved', 'denied'].includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('event_role_requests')
    .update({ status })
    .eq('id', id)
    .select('id, role_label, profile_id, profile:profiles!profile_id(first_name, contact_email), event:calendar_events!event_id(title, start_time)')
    .single()

  if (!error && data?.profile) {
    const profileData = data.profile as any
    const eventData = data.event as any

    if (profileData.contact_email) {
      import('@/lib/email/send').then(({ sendNotificationEmail }) => {
        import('@/lib/email/templates/render').then(({ renderEmailTemplate }) => {
          import('@/lib/email/templates/EventRoleRequestEmail').then(({ EventRoleRequestEmail }) => {
            renderEmailTemplate(
              EventRoleRequestEmail({
                firstName: profileData.first_name || 'Member',
                eventTitle: eventData?.title || 'Event',
                eventDate: eventData?.start_time ? new Date(eventData.start_time).toLocaleDateString() : 'TBD',
                roleLabel: data.role_label,
                status: status as 'approved' | 'denied',
              })
            ).then(html => {
              sendNotificationEmail({
                to: profileData.contact_email,
                subject: `Event Role Request ${status === 'approved' ? 'Approved ✓' : 'Declined'}`,
                html,
                template: 'event_role_request_result',
                meta: { request_id: data.id, profile_id: data.profile_id },
              }).catch(console.error)
            }).catch(console.error)
          }).catch(console.error)
        }).catch(console.error)
      }).catch(console.error)
    }
  }

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
