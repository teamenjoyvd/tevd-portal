import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

/**
 * Link an ad-hoc guest to a real member, or unlink them (2607-DEV-677).
 *
 * A RECORD ONLY. It moves no money and rewrites no payments row: the guest's
 * payments stay on the payer's ledger, where the payer's financial
 * responsibility for them put them.
 *
 * Manual by design. Nothing here matches on email, because profiles.contact_email
 * is user-editable and unverified — auto-matching would let anyone claim a
 * stranger's guest history by typing their address.
 *
 * `linked_profile_id: null` unlinks.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'adminOrCore')
  if (ctx.guard) return ctx.guard

  const { id } = await params
  const body = await req.json().catch(() => null)

  // Compared to undefined explicitly: `null` is the unlink instruction and must
  // not be read as "the key is missing".
  if (body === null || body.linked_profile_id === undefined) {
    return Response.json({ error: 'linked_profile_id is required (null to unlink)' }, { status: 400 })
  }

  const linkedProfileId: string | null = body.linked_profile_id
  if (linkedProfileId !== null && typeof linkedProfileId !== 'string') {
    return Response.json({ error: 'linked_profile_id must be a profile id or null' }, { status: 400 })
  }

  // Checked before the update so a bad id is a 404 naming the problem rather
  // than a raw foreign-key error from Postgres.
  if (linkedProfileId !== null) {
    const { data: target } = await supabase
      .from('profiles').select('id').eq('id', linkedProfileId).single()
    if (!target) return Response.json({ error: 'Member not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('payment_guests')
    .update({ linked_profile_id: linkedProfileId })
    .eq('id', id)
    .select(
      'id, name, email, created_at, linked_profile_id, owner_profile_id, owner:profiles!owner_profile_id(id, first_name, last_name, abo_number), linked:profiles!linked_profile_id(id, first_name, last_name, abo_number)',
    )
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Guest not found' }, { status: 404 })

  return Response.json(data)
}
