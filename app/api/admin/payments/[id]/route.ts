import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

/** Shape returned by the `.select()` join on the PATCH query. */
interface PaymentWithJoins {
  id: string
  amount: number
  currency: string
  transaction_date: string
  admin_status: string
  admin_note: string | null
  profile_id: string
  profile: { first_name: string; contact_email: string | null } | null
  trips: { title: string } | null
  payable_items: { title: string } | null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'adminOrCore')
  if (ctx.guard) return ctx.guard

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
    .select('*, profile:profiles!profile_id(first_name, contact_email), trips(title), payable_items(title)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Cast to the typed interface — Supabase cannot infer aliased join shapes
  const typed = data as unknown as PaymentWithJoins

  // Trigger email asynchronously
  const itemTitle = typed.trips?.title || typed.payable_items?.title || 'Unknown Item'
  const emailStatus = admin_status === 'rejected' ? 'denied' : 'approved'

  if (typed.profile?.contact_email) {
    const profileEmail = typed.profile.contact_email
    const profileFirstName = typed.profile.first_name || 'Member'

    import('@/lib/email/send').then(({ sendNotificationEmail }) => {
      import('@/lib/email/templates/render').then(({ renderEmailTemplate }) => {
        import('@/lib/email/templates/PaymentStatusEmail').then(({ PaymentStatusEmail }) => {
          renderEmailTemplate(
            PaymentStatusEmail({
              firstName: profileFirstName,
              amount: typed.amount,
              currency: typed.currency,
              transactionDate: typed.transaction_date,
              adminStatus: emailStatus,
              itemTitle,
              adminNote: admin_note,
            })
          ).then(html => {
            sendNotificationEmail({
              to: profileEmail,
              subject: `Payment ${emailStatus === 'approved' ? 'Approved ✓' : 'Declined'}`,
              html,
              template: 'payment_status',
              meta: { payment_id: typed.id, profile_id: typed.profile_id },
            }).catch(console.error)
          }).catch(console.error)
        }).catch(console.error)
      }).catch(console.error)
    }).catch(console.error)
  }

  return Response.json(data)
}
