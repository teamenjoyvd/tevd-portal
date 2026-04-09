import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { TripRegistrationEmail } from '@/lib/email/templates/TripRegistrationEmail'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: adminProfile } = await supabase
    .from('profiles').select('id, role').eq('clerk_id', userId).single()
  if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'core')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: registrationId } = await params

  const { data: registration } = await supabase
    .from('trip_registrations')
    .select('id, cancelled_at')
    .eq('id', registrationId)
    .single()

  if (!registration) return Response.json({ error: 'Registration not found' }, { status: 404 })
  if (registration.cancelled_at) return Response.json({ error: 'Already cancelled' }, { status: 409 })

  const { data, error } = await supabase
    .from('trip_registrations')
    .update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: adminProfile.id,
    })
    .eq('id', registrationId)
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
        status: 'cancelled',
      })
    ).then((html) => {
      sendEmail({
        to: regProfile.contact_email,
        subject: `Trip Registration Cancelled`,
        html,
        template: 'trip_registration_status',
        meta: { registration_id: data.id, trip_id: data.trip_id, profile_id: data.profile_id },
      }).catch(console.error)
    }).catch(console.error)
  }

  return Response.json(data)
}
