import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'
import { upsertTreeNode } from '@/lib/supabase/rpc'

// Path C: admin directly verifies a guest with no prior submission.
// Sets role=member, stores upline_abo_number, places a placeholder tree node.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { profile_id, upline_abo_number } = await req.json()
  if (!profile_id || !upline_abo_number) {
    return Response.json({ error: 'profile_id and upline_abo_number are required' }, { status: 400 })
  }

  // Promote to member and store upline
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ role: 'member', upline_abo_number })
    .eq('id', profile_id)

  if (profileErr) return Response.json({ error: profileErr.message }, { status: 500 })

  // Sync role to Clerk publicMetadata so UserDropdown reflects immediately
  const { data: promoted } = await supabase
    .from('profiles').select('clerk_id').eq('id', profile_id).single()
  if (promoted?.clerk_id) {
    const clerk = await clerkClient()
    await clerk.users.updateUserMetadata(promoted.clerk_id, {
      publicMetadata: { role: 'member' },
    })
  }

  // p_abo_number=null triggers the no-ABO placeholder path in the function
  const { error: treeErr } = await upsertTreeNode(supabase, {
    p_profile_id: profile_id,
    p_abo_number: null,
    p_sponsor_abo_number: upline_abo_number,
  })

  if (treeErr) return Response.json({ error: treeErr.message }, { status: 500 })

  // Create a resolved verification record (upsert in case a pending request exists)
  const { data, error: reqErr } = await supabase
    .from('abo_verification_requests')
    .upsert(
      {
        profile_id,
        claimed_abo: null,
        claimed_upline_abo: upline_abo_number,
        request_type: 'manual',
        status: 'approved',
        resolved_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    )
    .select().single()

  if (reqErr) return Response.json({ error: reqErr.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
