import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotificationEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { TripRegistrationEmail } from '@/lib/email/templates/TripRegistrationEmail'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .from('trip_registrations')
    .update({ status })
    .eq('id', id)
    .select('*, profile:profiles(id, first_name, contact_email), trip:trips(id, title, destination, start_date, end_date)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Trigger email asynchronously
  const regProfile = data.profile as any
  const regTrip = data.trip as any
  if (regProfile?.contact_email) {
    renderEmailTemplate(
      TripRegistrationEmail({
        firstName: regProfile.first_name || 'Member',
        tripTitle: regTrip.title,
        destination: regTrip.destination,
        startDate: regTrip.start_date,
        endDate: regTrip.end_date,
        status: status as 'approved' | 'denied',
      })
    ).then((html) => {
      sendNotificationEmail({
        to: regProfile.contact_email,
        subject: `Trip Registration ${status === 'approved' ? 'Approved ✓' : 'Declined'}`,
        html,
        template: 'trip_registration_status',
        meta: { registration_id: data.id, trip_id: data.trip_id, profile_id: data.profile_id },
      }).catch(console.error)
    }).catch(console.error)
  }

  return Response.json(data)
}
