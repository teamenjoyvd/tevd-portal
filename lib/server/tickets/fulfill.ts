import type Stripe from 'stripe'
import type { createServiceClient } from '@/lib/supabase/service'
import { ticketErrorCode } from './errors'
import { withFreshCodes, type TicketPass } from './passes'

type Deps = {
  supabase: ReturnType<typeof createServiceClient>
  stripe: Pick<Stripe, 'checkout'>
  sendEmail: (passId: string) => Promise<unknown>
}

type FulfilData = { just_fulfilled: boolean; pass: TicketPass; door_admission_id: string | null; door_error: string | null }

export type FulfilResult =
  | { status: 'not_found' | 'unpaid' | 'mismatch' }
  | { status: 'fulfilled'; pass: TicketPass; eventId: string | null; justFulfilled: boolean; doorAdmitted: boolean; doorError: string | null }

/** Safe to call any number of times, from the webhook and the return page at once. */
export async function fulfillOrder({ supabase, stripe, sendEmail }: Deps, sessionId: string): Promise<FulfilResult> {
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.client_reference_id === null) return { status: 'not_found' }
  const { data: order, error } = await supabase
    .from('ticket_orders')
    .select('id, total_cents, currency, stripe_checkout_session_id')
    .eq('id', session.client_reference_id)
    .maybeSingle()
  if (error) throw error
  if (order === null || order.stripe_checkout_session_id !== session.id) return { status: 'not_found' }
  if (session.payment_status !== 'paid') return { status: 'unpaid' }
  if (session.amount_total !== order.total_cents || session.currency !== 'eur' || order.currency !== 'eur') {
    console.error('[tickets] payment does not match the order', order.id)
    return { status: 'mismatch' }
  }

  const result = await withFreshCodes(({ unlockCode, qrToken }) =>
    supabase.rpc('fulfill_ticket_order', {
      p_order_id: order.id,
      p_session_id: session.id,
      p_unlock_code: unlockCode,
      p_qr_token: qrToken,
    }),
  )
  if (result.error) {
    if (ticketErrorCode(result.error) === 'not_found') return { status: 'not_found' }
    throw result.error
  }
  const data = result.data as unknown as FulfilData

  // The claim inside decides whether anything is sent. A failure is retried by
  // the email job and must not hide the pass from the buyer.
  try {
    await sendEmail(data.pass.id)
  } catch (err) {
    console.error('[tickets] pass email failed', data.pass.id, err instanceof Error ? err.name : 'error')
  }
  return {
    status: 'fulfilled',
    pass: data.pass,
    eventId: session.metadata?.event_id ?? null,
    justFulfilled: data.just_fulfilled,
    doorAdmitted: data.door_admission_id !== null,
    doorError: data.door_error,
  }
}
