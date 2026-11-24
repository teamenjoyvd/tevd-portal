import type Stripe from 'stripe'
import type { createServiceClient } from '@/lib/supabase/service'
import { alertAdmins } from './alerts'
import { fulfillOrder } from './fulfill'

type Deps = {
  supabase: ReturnType<typeof createServiceClient>
  stripe: Stripe
  sendEmail: (passId: string) => Promise<unknown>
}

const idOf = (value: string | { id: string }) => (typeof value === 'string' ? value : value.id)

/** Throws to make Stripe redeliver; the event is marked processed only when this returns. */
export async function handleStripeEvent(deps: Deps, event: Stripe.Event): Promise<void> {
  const { supabase } = deps
  const { data: seen, error } = await supabase
    .from('stripe_events')
    .select('processed_at')
    .eq('event_id', event.id)
    .maybeSingle()
  if (error) throw error
  if (seen?.processed_at) return

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const result = await fulfillOrder(deps, event.data.object.id)
      if (result.status === 'mismatch') {
        await alertAdmins(supabase, 'A ticket payment does not match its order. No pass was issued. Check it in Stripe.')
      }
      if (result.status === 'fulfilled' && result.justFulfilled && result.doorError !== null) {
        await alertAdmins(supabase, 'A ticket was bought at the door but the person could not be admitted. The entry is unused.')
      }
      break
    }
    case 'checkout.session.expired': {
      const { error: expireError } = await supabase
        .from('ticket_orders')
        .update({ status: 'expired' })
        .eq('stripe_checkout_session_id', event.data.object.id)
        .eq('status', 'pending')
      if (expireError) throw expireError
      break
    }
    case 'charge.refunded': {
      const charge = event.data.object
      const orderId = charge.metadata.order_id
      if (!orderId) break
      if (charge.refunded) await voidOrder(deps, orderId, 'refunded')
      else await alertAdmins(supabase, 'A ticket payment was partly refunded. The pass is still valid.')
      break
    }
    case 'charge.dispute.created': {
      const charge = await deps.stripe.charges.retrieve(idOf(event.data.object.charge))
      if (charge.metadata.order_id) await voidOrder(deps, charge.metadata.order_id, 'disputed')
      break
    }
    default:
      return
  }

  const { error: markError } = await supabase
    .from('stripe_events')
    .upsert({ event_id: event.id, type: event.type, processed_at: new Date().toISOString() })
  if (markError) throw markError
}

async function voidOrder({ supabase }: Deps, orderId: string, reason: 'refunded' | 'disputed'): Promise<void> {
  const { data: pass, error } = await supabase.from('ticket_passes').select('id, status').eq('order_id', orderId).maybeSingle()
  if (error) throw error
  if (pass === null) {
    const { data: order, error: orderError } = await supabase.from('ticket_orders').select('id').eq('id', orderId).maybeSingle()
    if (orderError) throw orderError
    // Not one of ours (the Stripe account may serve other things).
    if (order === null) return
    // Stripe does not order events: retry until the pass exists, then void it.
    throw new Error('Pass not issued yet')
  }
  if (pass.status === 'void') return
  const { error: voidError } = await supabase
    .from('ticket_passes')
    .update({ status: 'void', void_reason: reason })
    .eq('id', pass.id)
  if (voidError) throw voidError
  const { error: auditError } = await supabase
    .from('ticket_audit')
    .insert({ action: 'stripe_void', pass_id: pass.id, after: { reason } })
  if (auditError) console.error('[tickets] audit failed', pass.id)
  await alertAdmins(
    supabase,
    `A ticket payment was ${reason}. Its pass is void. Anyone already let in online must be removed in Zoom by hand.`,
  )
}
