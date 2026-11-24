import type Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/server/stripe/client'
import { sendPassEmail } from '@/lib/server/tickets/pass-email'
import { handleStripeEvent } from '@/lib/server/tickets/stripe-events'

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: 'Not configured' }, { status: 503 })

  const raw = await req.text()
  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, req.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()
  try {
    await handleStripeEvent({ supabase, stripe, sendEmail: (id) => sendPassEmail(supabase, id) }, event)
  } catch (err) {
    console.error('[stripe webhook]', event.type, event.id, err instanceof Error ? err.name : 'error')
    return Response.json({ error: 'Retry' }, { status: 500 })
  }
  return Response.json({ received: true })
}
