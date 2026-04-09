import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'
import { sendEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { AboVerificationEmail } from '@/lib/email/templates/AboVerificationEmail'
import { DocumentExpiryEmail } from '@/lib/email/templates/DocumentExpiryEmail'
import { EventRoleRequestEmail } from '@/lib/email/templates/EventRoleRequestEmail'
import { PaymentStatusEmail } from '@/lib/email/templates/PaymentStatusEmail'
import { PaymentSubmittedEmail } from '@/lib/email/templates/PaymentSubmittedEmail'
import { TripRegistrationEmail } from '@/lib/email/templates/TripRegistrationEmail'
import { WelcomeEmail } from '@/lib/email/templates/WelcomeEmail'

// Map template keys to their visual components for rendering during retry
const TEMPLATE_COMPONENTS: Record<string, any> = {
  welcome: WelcomeEmail,
  payment_status: PaymentStatusEmail,
  document_expiring_soon: DocumentExpiryEmail,
  doc_expiry: DocumentExpiryEmail,
  abo_verification_result: AboVerificationEmail,
  trip_registration_status: TripRegistrationEmail,
  event_role_request_result: EventRoleRequestEmail,
  trip_registration_cancelled: TripRegistrationEmail, // Uses same template usually or specific one if exists
  payment_submitted: PaymentSubmittedEmail,
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { id } = params

  // 1. Fetch the failed log row
  const { data: log, error: fetchErr } = await supabase
    .from('email_log')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !log) return Response.json({ error: 'Log entry not found' }, { status: 444 })
  if (log.status === 'sent') return Response.json({ error: 'Email already sent' }, { status: 400 })

  // 2. Re-render the HTML based on the original payload/template
  const TemplateComponent = TEMPLATE_COMPONENTS[log.template]
  if (!TemplateComponent) return Response.json({ error: `No renderer for template: ${log.template}` }, { status: 500 })

  try {
    const html = await renderEmailTemplate(TemplateComponent(log.payload as any))

    // 3. Re-invoke sendEmail
    // Note: sendEmail already logs its own result to a NEW row.
    // We should ideally update the OLD row to 'retried' or similar, but for now 
    // the UI just cares that a new attempt is made.
    await sendEmail({
      to: log.recipient,
      subject: `[RETRY] ${log.template.replace(/_/g, ' ')}`,
      html,
      template: log.template,
      meta: log.payload as Record<string, unknown>,
    })

    // Update old row status so it's not retried again indefinitely
    await supabase.from('email_log').update({ status: 'retried' }).eq('id', id)

    return Response.json({ success: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
