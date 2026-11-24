import { auth, currentUser } from '@clerk/nextjs/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { consumeCheckoutSlot } from '@/lib/rate-limit'
import { getStripe, isStripeConfigured } from '@/lib/server/stripe/client'
import { verifiedEmails } from '@/lib/server/tickets/passes'
import { getSale, isDoorOpen, isRoomFull } from '@/lib/server/tickets/sales'
import { getBaseUrl } from '@/lib/utils/base-url'

/** Price, entries and currency are never read from the request. */
const bodySchema = z.object({
  event_id: z.uuid(),
  product_id: z.uuid(),
  name: z.string().trim().min(2).max(200),
  email: z.email().max(320),
  door: z.boolean().default(false),
  lang: z.enum(['en', 'bg']).default('bg'),
})

const PRODUCT_NAMES = {
  single: { en: 'Event ticket', bg: 'Билет за събитие' },
  pack: { en: 'Ticket pack', bg: 'Пакет билети' },
} as const

const fail = (status: number, code: string) => Response.json({ error: 'Checkout unavailable', code }, { status })

/** Links the order to the caller only when the ticket is for their own verified email. */
async function buyerProfileId(supabase: ReturnType<typeof createServiceClient>, email: string): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  if (user === null || !verifiedEmails(user).includes(email.toLowerCase())) return null
  const { data, error } = await supabase.from('profiles').select('id').eq('clerk_id', userId).maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function POST(req: Request) {
  if (!isStripeConfigured()) return fail(503, 'not_configured')
  const body = bodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return fail(400, 'invalid_input')
  const input = body.data

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  if (!(await consumeCheckoutSlot(ip === '' ? 'unknown' : ip))) return fail(429, 'rate_limited')

  const supabase = createServiceClient()
  try {
    const sale = await getSale(supabase, input.event_id)
    if (sale === null) return fail(404, 'not_found')
    if (!sale.salesOpen) return fail(409, 'sales_closed')
    const product = sale.products.find((p) => p.id === input.product_id)
    if (product === undefined) return fail(404, 'not_found')
    if (input.door) {
      if (!isDoorOpen(sale.event)) return fail(409, 'door_closed')
      if (await isRoomFull(supabase, sale.event)) return fail(409, 'full')
    }

    const baseUrl = await getBaseUrl()
    const { data: order, error } = await supabase
      .from('ticket_orders')
      .insert({
        buyer_name: input.name,
        buyer_email: input.email,
        buyer_profile_id: await buyerProfileId(supabase, input.email),
        product_id: product.id,
        door_event_id: input.door ? sale.event.id : null,
        total_cents: product.price_cents,
      })
      .select('id')
      .single()
    if (error) throw error

    const metadata = { order_id: order.id, event_id: sale.event.id }
    const session = await getStripe().checkout.sessions.create(
      {
        mode: 'payment',
        ui_mode: 'embedded_page',
        allowed_payment_method_types: ['card'],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: product.price_cents,
              product_data: {
                name: `${PRODUCT_NAMES[product.kind === 'pack' ? 'pack' : 'single'][input.lang]} · ${sale.event.title}`,
              },
            },
          },
        ],
        client_reference_id: order.id,
        metadata,
        // Copied to the charge, which is how a refund or dispute finds its order.
        payment_intent_data: { metadata },
        customer_email: input.email,
        locale: input.lang,
        return_url: `${baseUrl}/events/${sale.event.id}/buy/return?session_id={CHECKOUT_SESSION_ID}`,
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      },
      { idempotencyKey: order.id },
    )

    // Until this is stored nobody can pay: the client secret has not left the server.
    const { error: storeError } = await supabase
      .from('ticket_orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id)
    if (storeError) throw storeError
    return Response.json({ client_secret: session.client_secret })
  } catch (err) {
    console.error('[POST /api/tickets/checkout]', err instanceof Error ? err.name : 'error')
    return fail(500, 'failed')
  }
}
