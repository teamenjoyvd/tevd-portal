import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerProfile } from '@/lib/supabase/guards'

/**
 * Withdraw a whole on-behalf payment group (2607-DEV-676).
 *
 * Withdraw is a HARD DELETE. A `withdrawn_at` column would force
 * `AND withdrawn_at IS NULL` into every existing payments query, and missing one
 * would make a withdrawn payment reappear as real money. There is nothing to
 * audit: by definition these rows are still `pending` and self-submitted, and no
 * total has counted them.
 *
 * Ownership and pending-ness are asserted inside the RPC's DELETE ... WHERE, so
 * there is no TOCTOU window against an admin approving concurrently. A group
 * that is not the caller's, or no longer pending, deletes 0 rows and 404s —
 * the same answer either way, so this cannot be used to probe.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> },
): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const profile = await getCallerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { groupId } = await params

  const { data, error } = await supabase.rpc('withdraw_payment_group', {
    p_group_id: groupId,
    p_payer: profile.id,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const result = Array.isArray(data) ? data[0] : data
  const deleted = result?.deleted ?? 0
  if (deleted === 0) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Best effort, deliberately after the rows are gone: a storage hiccup must
  // never fail a withdraw the database has already committed. Only remove the
  // object once nothing references it — an admin-logged row could share it.
  const proofUrl = result?.proof_url ?? null
  if (proofUrl) {
    const { count } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('proof_url', proofUrl)

    if ((count ?? 0) === 0) {
      const { error: storageError } = await supabase.storage.from('trip-proofs').remove([proofUrl])
      if (storageError) console.error('withdraw_payment_group: orphaned proof object', proofUrl, storageError)
    }
  }

  return new Response(null, { status: 204 })
}
