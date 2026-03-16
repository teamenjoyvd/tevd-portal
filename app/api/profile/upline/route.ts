import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('abo_number')
    .eq('clerk_id', userId)
    .single()

  if (!profile?.abo_number) {
    return Response.json({ upline_name: null })
  }

  const { data: losMember } = await supabase
    .from('los_members')
    .select('sponsor_abo_number')
    .eq('abo_number', profile.abo_number)
    .single()

  if (!losMember?.sponsor_abo_number) {
    return Response.json({ upline_name: null })
  }

  const { data: upline } = await supabase
    .from('los_members')
    .select('name')
    .eq('abo_number', losMember.sponsor_abo_number)
    .single()

  return Response.json({ upline_name: upline?.name ?? null })
}