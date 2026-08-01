import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

/**
 * The admin guest-link queue (2607-DEV-677).
 *
 * Ad-hoc guests are free text typed by a payer, so the same person can exist
 * several times over under different spellings and none of them is a member.
 * An admin links a guest to a real profile once it becomes clear who they are —
 * a RECORD ONLY: it moves no money and rewrites no payments row.
 *
 * `?unlinked=1` narrows to the ones still needing that decision.
 *
 * Only guests that have actually been paid for are returned. A row with no
 * payments is a half-finished form, not a person to reconcile.
 *
 * Both embeds are FK-hinted: payment_guests has TWO foreign keys to profiles
 * (owner_profile_id, linked_profile_id) and PostgREST 500s on an ambiguous
 * embed — the same trap GOTCHAS row 12 documents for payments.
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'adminOrCore')
  if (ctx.guard) return ctx.guard

  const unlinkedOnly = new URL(req.url).searchParams.get('unlinked') === '1'

  let query = supabase
    .from('payment_guests')
    .select(
      'id, name, email, created_at, linked_profile_id, owner_profile_id, owner:profiles!owner_profile_id(id, first_name, last_name, abo_number), linked:profiles!linked_profile_id(id, first_name, last_name, abo_number)',
    )
    .order('created_at', { ascending: false })

  if (unlinkedOnly) query = query.is('linked_profile_id', null)

  const { data: guests, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!guests || guests.length === 0) return Response.json([])

  // Counted in a second round trip rather than a PostgREST aggregate embed: the
  // count is over the payments side of the FK, and one `in` query is both
  // simpler to read and independent of which aggregate syntax this PostgREST
  // version accepts.
  const { data: paidRows, error: countError } = await supabase
    .from('payments')
    .select('beneficiary_guest_id')
    .in('beneficiary_guest_id', guests.map((g) => g.id))

  if (countError) return Response.json({ error: countError.message }, { status: 500 })

  const counts = new Map<string, number>()
  for (const row of paidRows ?? []) {
    if (!row.beneficiary_guest_id) continue
    counts.set(row.beneficiary_guest_id, (counts.get(row.beneficiary_guest_id) ?? 0) + 1)
  }

  return Response.json(
    guests
      .filter((g) => (counts.get(g.id) ?? 0) > 0)
      .map((g) => ({ ...g, payment_count: counts.get(g.id) ?? 0 })),
  )
}
