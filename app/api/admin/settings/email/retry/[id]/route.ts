import type * as React from 'react'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'
import { sendNotificationEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { AboVerificationEmail } from '@/lib/email/templates/AboVerificationEmail'
import { DocumentExpiryEmail } from '@/lib/email/templates/DocumentExpiryEmail'
import { EventRoleRequestEmail } from '@/lib/email/templates/EventRoleRequestEmail'
import { PaymentStatusEmail } from '@/lib/email/templates/PaymentStatusEmail'
import { PaymentSubmittedEmail } from '@/lib/email/templates/PaymentSubmittedEmail'
import { TripRegistrationEmail } from '@/lib/email/templates/TripRegistrationEmail'
import { WelcomeEmail } from '@/lib/email/templates/WelcomeEmail'

// React.FC<P> is always callable — React.ComponentType<P> is FC | ComponentClass,
// and ComponentClass has no call signature, causing a TS error at the call site.
type EmailTemplateFC = React.FC<Record<string, unknown>>

// Map template keys to their visual components for rendering during retry
const TEMPLATE_COMPONENTS: Record<string, EmailTemplateFC> = {
  welcome: WelcomeEmail as EmailTemplateFC,
  payment_status: PaymentStatusEmail as EmailTemplateFC,
  document_expiring_soon: DocumentExpiryEmail as EmailTemplateFC,
  doc_expiry: DocumentExpiryEmail as EmailTemplateFC,
  abo_verification_result: AboVerificationEmail as EmailTemplateFC,
  trip_registration_status: TripRegistrationEmail as EmailTemplateFC,
  event_role_request_result: EventRoleRequestEmail as EmailTemplateFC,
  trip_registration_cancelled: TripRegistrationEmail as EmailTemplateFC,
  payment_submitted: PaymentSubmittedEmail as EmailTemplateFC,
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { id } = await params

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
    const html = await renderEmailTemplate(TemplateComponent(log.payload as Record<string, unknown>))

    // 3. Re-invoke sendNotificationEmail — bypasses no gates since this is an
    //    admin-triggered retry; a new email_log row is written by the dispatcher.
    await sendNotificationEmail({
      to: log.recipient,
      subject: `[RETRY] ${log.template.replace(/_/g, ' ')}`,
      html,
      template: log.template,
      meta: log.payload as Record<string, unknown>,
    })

    // Update old row status so it's not retried again indefinitely
    await supabase.from('email_log').update({ status: 'retried' }).eq('id', id)

    return Response.json({ success: true })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
