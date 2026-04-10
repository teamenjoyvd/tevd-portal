import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin' && profile?.role !== 'core') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { admin_status, admin_note } = body

  if (!admin_status || !['approved', 'rejected'].includes(admin_status)) {
    return Response.json({ error: 'admin_status must be approved or rejected' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('payments')
    .update({ admin_status, admin_note: admin_note ?? null })
    .eq('id', id)
    .select('*, profile:profiles(first_name, contact_email), trips(title), payable_items(title)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Trigger email asynchronously
  const paymentProfile = data.profile as any
  const tripsData = data.trips as any
  const itemsData = data.payable_items as any
  const itemTitle = tripsData?.title || itemsData?.title || 'Unknown Item'
  const emailStatus = admin_status === 'rejected' ? 'denied' : 'approved'

  if (paymentProfile?.contact_email) {
    import('@/lib/email/send').then(({ sendNotificationEmail }) => {
      import('@/lib/email/templates/render').then(({ renderEmailTemplate }) => {
        import('@/lib/email/templates/PaymentStatusEmail').then(({ PaymentStatusEmail }) => {
          renderEmailTemplate(
            PaymentStatusEmail({
              firstName: paymentProfile.first_name || 'Member',
              amount: data.amount,
              currency: data.currency,
              transactionDate: data.transaction_date,
              adminStatus: emailStatus,
              itemTitle,
              adminNote: admin_note,
            })
          ).then(html => {
            sendNotificationEmail({
              to: paymentProfile.contact_email,
              subject: `Payment ${emailStatus === 'approved' ? 'Approved ✓' : 'Declined'}`,
              html,
              template: 'payment_status',
              meta: { payment_id: data.id, profile_id: data.profile_id },
            }).catch(console.error)
          }).catch(console.error)
        }).catch(console.error)
      }).catch(console.error)
    }).catch(console.error)
  }

  return Response.json(data)
}
