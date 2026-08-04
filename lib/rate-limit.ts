import { createServiceClient } from '@/lib/supabase/service'

// Guest-invite abuse guards (2607-DEV-591), reworked atomic in 2608-DEV-625.
//
// These used to COUNT rows and let the caller write afterwards, which meant N
// concurrent submissions all read a count below `max` and all proceeded — the
// exact burst the guards exist to stop. They now delegate to the
// `consume_rate_limit` RPC, where prune/count/insert happen inside one
// transaction holding a per-key advisory lock.
//
// Hence `consume*`, not `check*`: every allowed call has SPENT a slot. Calling
// one of these twice for the same action burns two slots.

const RPC = 'consume_rate_limit'

// PostgREST reports an unresolvable function as PGRST202; Postgres' own
// undefined_function is 42883. Nothing else falls back — see legacy* below.
const MISSING_FUNCTION_CODES = new Set(['PGRST202', '42883'])

function isMissingFunction(error: { code?: string | null } | null): boolean {
  return error?.code != null && MISSING_FUNCTION_CODES.has(error.code)
}

/** `true`/`false` = the RPC decided; `'rpc-missing'` = it isn't deployed yet. */
type Outcome = boolean | 'rpc-missing'

async function consumeSlot(key: string, windowMs: number, max: number): Promise<Outcome> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc(RPC, {
    p_key:       key,
    p_window_ms: windowMs,
    p_max:       max,
  })

  if (error) {
    if (isMissingFunction(error)) return 'rpc-missing'
    // Fail closed: a broken guard must not silently unblock the abuse it is
    // meant to enforce.
    console.error('consume_rate_limit failed, denying', { key, error })
    return false
  }
  // `data` is boolean | null. A null here means the RPC returned no row at all,
  // which it cannot do — treat anything but an explicit true as a denial.
  return data === true
}

// -- Email send caps ----------------------------------------------------------
// `template` narrows to one email type (e.g. the 3/h magic-link resend cap);
// omit it to cap all templates sent to that recipient (the 10/day overall cap).
// The two scopes are separate keys, so they count independently.

type EmailCapArgs = {
  recipient: string
  template?: string
  windowMs: number
  max: number
}

export async function consumeEmailCap({
  recipient,
  template,
  windowMs,
  max,
}: EmailCapArgs): Promise<boolean> {
  const key = template ? `email:${recipient}:${template}` : `email:${recipient}`

  const outcome = await consumeSlot(key, windowMs, max)
  if (outcome !== 'rpc-missing') return outcome
  return legacyEmailCap({ recipient, template, windowMs, max })
}

// -- Registration throttle ----------------------------------------------------
// Keyed by share_link_id when the load carried one, else by event_id (covers
// token-less / direct-URL loads).

type RegistrationSlotArgs = {
  shareLinkId: string | null
  eventId: string
  windowMs: number
  max: number
}

export async function consumeRegistrationSlot({
  shareLinkId,
  eventId,
  windowMs,
  max,
}: RegistrationSlotArgs): Promise<boolean> {
  const key = shareLinkId ? `guest-reg:link:${shareLinkId}` : `guest-reg:event:${eventId}`

  const outcome = await consumeSlot(key, windowMs, max)
  if (outcome !== 'rpc-missing') return outcome
  return legacyRegistrationThrottle({ shareLinkId, eventId, windowMs, max })
}

// -- Transitional fallback (remove once the RPC is live in production) --------
// Vercel deploys on merge while `migrate-prod` waits for manual approval, so
// production briefly runs this code against a schema with no
// `consume_rate_limit`. Both guards fail CLOSED, which on a public flow would
// deny every guest registration and every guest email. These two functions are
// the pre-2608-DEV-625 count-based implementations, kept verbatim to cover that
// window only — they are racy, which is the whole point of the rework, so they
// run for the missing-function codes above and for nothing else.
// Removal is tracked by the follow-up issue opened at GCR.

async function legacyEmailCap({ recipient, template, windowMs, max }: EmailCapArgs): Promise<boolean> {
  const supabase = createServiceClient()
  const windowStart = new Date(Date.now() - windowMs).toISOString()

  let query = supabase
    .from('notification_delivery_log')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'email')
    .eq('recipient', recipient)
    .gte('created_at', windowStart)

  if (template) query = query.eq('template', template)

  const { count, error } = await query
  if (error) {
    console.error('legacyEmailCap query failed, denying', { recipient, template, error })
    return false
  }
  return (count ?? 0) < max
}

async function legacyRegistrationThrottle({
  shareLinkId,
  eventId,
  windowMs,
  max,
}: RegistrationSlotArgs): Promise<boolean> {
  const supabase = createServiceClient()
  const windowStart = new Date(Date.now() - windowMs).toISOString()

  let query = supabase
    .from('guest_registrations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', windowStart)

  query = shareLinkId ? query.eq('share_link_id', shareLinkId) : query.eq('event_id', eventId)

  const { count, error } = await query
  if (error) {
    console.error('legacyRegistrationThrottle query failed, denying', { shareLinkId, eventId, error })
    return false
  }
  return (count ?? 0) < max
}
