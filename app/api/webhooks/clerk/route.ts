import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { Webhook } from 'svix'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    return Response.json({ error: 'Missing CLERK_WEBHOOK_SECRET' }, { status: 500 })
  }

  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return Response.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    const { id, first_name, last_name, email_addresses, public_metadata } = evt.data

    // New registrations start as 'guest' — promoted to 'member' after ABO verification
    const role = (public_metadata?.role as string) ?? 'guest'
    const abo_number = (public_metadata?.abo_number as string) ?? null
    const email = email_addresses?.[0]?.email_address ?? ''

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          clerk_id: id,
          first_name: first_name ?? '',
          last_name: last_name ?? '',
          role: role as 'admin' | 'core' | 'member' | 'guest',
          abo_number,
          display_names: { en: `${first_name ?? ''} ${last_name ?? ''}`.trim() },
        },
        { onConflict: 'clerk_id' }
      )

    if (error) {
      console.error('Supabase upsert error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }
  }

  if (evt.type === 'user.deleted') {
    const { id } = evt.data
    if (id) {
      await supabase.from('profiles').delete().eq('clerk_id', id)
    }
  }

  return Response.json({ received: true }, { status: 200 })
}
