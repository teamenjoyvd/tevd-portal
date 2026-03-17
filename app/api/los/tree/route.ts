import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: caller } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (!caller || !['admin', 'core'].includes(caller.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all LOS members with profile joins
  const { data: losRows } = await supabase
    .rpc('get_los_members_with_profiles')

  // Fetch all vital signs
  const { data: vitalSigns } = await supabase
    .from('member_vital_signs')
    .select('profile_id, event_key, event_label, has_ticket, updated_at')

  // Map vital signs by profile_id
  const vsByProfile: Record<string, { event_key: string; event_label: string; has_ticket: boolean }[]> = {}
  for (const vs of vitalSigns ?? []) {
    if (!vsByProfile[vs.profile_id]) vsByProfile[vs.profile_id] = []
    vsByProfile[vs.profile_id].push(vs)
  }

  // Attach vital signs to each LOS member
  const nodes = (losRows ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    vital_signs: vsByProfile[row.profile_id as string] ?? [],
  }))

  return Response.json(nodes)
}
