import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, abo_number')
    .eq('clerk_id', userId)
    .single()

  if (!profile?.id || !profile.abo_number) {
    return Response.json({ depth: null, direct_downline_count: 0 })
  }

  // Get own tree node for depth
  const { data: ownNode } = await supabase
    .from('tree_nodes')
    .select('id, depth')
    .eq('profile_id', profile.id)
    .single()

  // Count direct downlines (children whose parent_id = ownNode.id)
  let directDownlineCount = 0
  if (ownNode?.id) {
    const { count } = await supabase
      .from('tree_nodes')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', ownNode.id)

    directDownlineCount = count ?? 0
  }

  return Response.json({
    depth: ownNode?.depth ?? null,
    direct_downline_count: directDownlineCount,
  })
}
