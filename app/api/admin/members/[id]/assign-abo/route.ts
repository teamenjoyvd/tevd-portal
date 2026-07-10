import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

// PATCH /api/admin/members/[id]/assign-abo
// Links a manually-verified no-ABO profile to a real LOS ABO number.
// Sets profiles.abo_number and promotes the p_<uuid> tree node to the real label.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: profile_id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const { abo_number, sponsor_abo_number } = await req.json()
  if (!abo_number) {
    return Response.json({ error: 'abo_number is required' }, { status: 400 })
  }

  // Set the real ABO number on the profile
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ abo_number })
    .eq('id', profile_id)

  if (profileErr) return Response.json({ error: profileErr.message }, { status: 500 })

  // Promote the placeholder tree node (p_<uuid>) to the real ABO label
  const { error: treeErr } = await supabase
    .rpc('upsert_tree_node', {
      p_profile_id: profile_id,
      p_abo_number: abo_number,
      p_sponsor_abo_number: sponsor_abo_number ?? null,
    })

  if (treeErr) return Response.json({ error: treeErr.message }, { status: 500 })

  return Response.json({ profile_id, abo_number, linked: true })
}
