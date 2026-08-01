import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

/**
 * Whole-group approve / reject / delete for on-behalf payments (2607-DEV-676).
 *
 * Groups are never resolved partially — /api/admin/payments/[id] 409s on any row
 * carrying a payment_group_id, so this is the only way to act on one. Half an
 * approved group would credit one person's ledger and not the other's from a
 * single real transfer.
 */

/** Shape of the rows read back after the group update. */
interface GroupRow {
  id: string
  amount: number
  currency: string
  transaction_date: string
  profile_id: string
  paid_by_profile_id: string | null
  beneficiary: { first_name: string; contact_email: string | null } | null
  payer: { first_name: string; contact_email: string | null } | null
  trips: { title: string } | null
  payable_items: { title: string } | null
}

const GROUP_SELECT =
  'id, amount, currency, transaction_date, profile_id, paid_by_profile_id, ' +
  'beneficiary:profiles!profile_id(first_name, contact_email), ' +
  'payer:profiles!paid_by_profile_id(first_name, contact_email), ' +
  'trips(title), payable_items(title)'

/** Fire-and-forget payment email, matching app/api/admin/payments/[id]/route.ts. */
function sendPaymentEmail(args: {
  to: string
  firstName: string
  amount: number
  currency: string
  transactionDate: string
  adminStatus: 'approved' | 'denied'
  itemTitle: string
  adminNote: string | null
  subject: string
  paymentId: string
  profileId: string
}): void {
  import('@/lib/email/send').then(({ sendNotificationEmail }) => {
    import('@/lib/email/templates/render').then(({ renderEmailTemplate }) => {
      import('@/lib/email/templates/PaymentStatusEmail').then(({ PaymentStatusEmail }) => {
        renderEmailTemplate(
          PaymentStatusEmail({
            firstName: args.firstName,
            amount: args.amount,
            currency: args.currency,
            transactionDate: args.transactionDate,
            adminStatus: args.adminStatus,
            itemTitle: args.itemTitle,
            adminNote: args.adminNote,
          })
        ).then(html => {
          sendNotificationEmail({
            to: args.to,
            subject: args.subject,
            html,
            template: 'payment_status',
            meta: { payment_id: args.paymentId, profile_id: args.profileId },
          }).catch(console.error)
        }).catch(console.error)
      }).catch(console.error)
    }).catch(console.error)
  }).catch(console.error)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'adminOrCore')
  if (ctx.guard) return ctx.guard

  const { groupId } = await params
  const body = await req.json()
  const { admin_status, admin_note } = body

  if (!admin_status || !['approved', 'rejected'].includes(admin_status)) {
    return Response.json({ error: 'admin_status must be approved or rejected' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('payments')
    .update({ admin_status, admin_note: admin_note ?? null })
    .eq('payment_group_id', groupId)
    .select(GROUP_SELECT)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as GroupRow[]
  if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 })

  const itemTitle = rows[0].trips?.title || rows[0].payable_items?.title || 'Unknown Item'
  const groupTotal = rows.reduce((acc, row) => acc + Number(row.amount), 0)

  if (admin_status === 'rejected') {
    // ONE email to the payer, not N to N beneficiaries: one person moved one sum
    // of money and only that person can act on the rejection.
    const payer = rows[0].payer
    if (payer?.contact_email) {
      sendPaymentEmail({
        to: payer.contact_email,
        firstName: payer.first_name || 'Member',
        amount: groupTotal,
        currency: rows[0].currency,
        transactionDate: rows[0].transaction_date,
        adminStatus: 'denied',
        itemTitle,
        adminNote: admin_note ?? null,
        subject: 'Payment Declined',
        paymentId: rows[0].id,
        profileId: rows[0].paid_by_profile_id ?? rows[0].profile_id,
      })
    }
  } else {
    // On approval each beneficiary is told what landed on their ledger, and for
    // how much — informational only, they never had to acknowledge it. The payer
    // is skipped when they are also a beneficiary of their own group: they
    // submitted it and do not need to be told about their own row.
    const payerId = rows[0].paid_by_profile_id
    for (const row of rows) {
      if (row.profile_id === payerId) continue
      if (!row.beneficiary?.contact_email) continue
      sendPaymentEmail({
        to: row.beneficiary.contact_email,
        firstName: row.beneficiary.first_name || 'Member',
        amount: Number(row.amount),
        currency: row.currency,
        transactionDate: row.transaction_date,
        adminStatus: 'approved',
        itemTitle,
        adminNote: admin_note ?? null,
        subject: 'Payment Approved ✓',
        paymentId: row.id,
        profileId: row.profile_id,
      })
    }
  }

  return Response.json({ payment_group_id: groupId, updated: rows.length, payments: data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> },
): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'adminOrCore')
  if (ctx.guard) return ctx.guard

  const { groupId } = await params

  // Deliberately NOT gated on admin_status. The single-row admin delete
  // (app/api/admin/payments/[id]/route.ts) has never been status-gated either,
  // and an admin correcting a wrongly-approved payment is a real workflow;
  // gating only the group form would remove a capability that exists for every
  // other row. The blast radius is instead made explicit before the click —
  // the confirmation dialog names the row count and the statuses involved.
  const { data, error } = await supabase
    .from('payments')
    .delete()
    .eq('payment_group_id', groupId)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if ((data ?? []).length === 0) return Response.json({ error: 'Not found' }, { status: 404 })

  return new Response(null, { status: 204 })
}
