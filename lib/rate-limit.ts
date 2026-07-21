import { createServiceClient } from '@/lib/supabase/service'

// -- Email send caps (counts notification_delivery_log) -----------------------
// `template` narrows to one email type (e.g. the 3/h magic-link resend cap);
// omit it to count all templates sent to that recipient (the 10/day overall cap).

export async function checkEmailCap({
  recipient,
  template,
  windowMs,
  max,
}: {
  recipient: string
  template?: string
  windowMs: number
  max: number
}): Promise<boolean> {
  const supabase = createServiceClient()
  const windowStart = new Date(Date.now() - windowMs).toISOString()

  let query = supabase
    .from('notification_delivery_log')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'email')
    .eq('recipient', recipient)
    .gte('created_at', windowStart)

  if (template) query = query.eq('template', template)

  const { count } = await query
  return (count ?? 0) < max
}

// -- Registration throttle (counts guest_registrations.created_at) ------------
// Keyed by share_link_id when the load carried one, else by event_id (covers
// token-less / direct-URL loads).

export async function checkRegistrationThrottle({
  shareLinkId,
  eventId,
  windowMs,
  max,
}: {
  shareLinkId: string | null
  eventId: string
  windowMs: number
  max: number
}): Promise<boolean> {
  const supabase = createServiceClient()
  const windowStart = new Date(Date.now() - windowMs).toISOString()

  let query = supabase
    .from('guest_registrations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', windowStart)

  query = shareLinkId ? query.eq('share_link_id', shareLinkId) : query.eq('event_id', eventId)

  const { count } = await query
  return (count ?? 0) < max
}
