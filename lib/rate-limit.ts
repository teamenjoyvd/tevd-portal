import { createHash } from 'crypto'
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

/**
 * A bucket key embeds the recipient's email address, so it must never reach a
 * log. This yields the scope plus a short digest — enough to correlate repeated
 * failures for one recipient without recording who they are.
 */
function keyDigest(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 12)
}

async function consumeSlot(key: string, scope: string, windowMs: number, max: number): Promise<boolean> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc(RPC, {
    p_key:       key,
    p_window_ms: windowMs,
    p_max:       max,
  })

  if (error) {
    // Fail closed, with no exceptions: a broken guard must not silently unblock
    // the abuse it is meant to enforce. 2608-DEV-696 removed the transitional
    // PGRST202/42883 fallback to the pre-625 count path — that path was racy by
    // construction, so treating "function missing" as a reason to use it would
    // re-open the exact burst this guard exists to stop.
    console.error('consume_rate_limit failed, denying', { scope, key: keyDigest(key), error })
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
  // Explicit null check, not truthiness: '' is a supplied template, not an
  // absent one, and must not silently collapse into the recipient-wide bucket.
  const scoped = template != null
  const key = scoped ? `email:${recipient}:${template}` : `email:${recipient}`

  return consumeSlot(key, scoped ? 'email+template' : 'email', windowMs, max)
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
  const byLink = shareLinkId !== null
  const key = byLink ? `guest-reg:link:${shareLinkId}` : `guest-reg:event:${eventId}`

  return consumeSlot(key, byLink ? 'guest-reg:link' : 'guest-reg:event', windowMs, max)
}
