import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

// Path C: admin directly verifies a guest with no prior submission.
// Sets role=member, stores upline_abo_number, places a placeholder tree node.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: admin } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (admin?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

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

  // Place placeholder tree node (p_abo_number=null → p_<uuid> label)
  const { error: treeErr } = await supabase
    .rpc('upsert_tree_node', {
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
