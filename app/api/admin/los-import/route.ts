import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Verify admin role in DB
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows } = await req.json()

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: 'No rows provided' }, { status: 400 })
  }

  // Bulk upsert via RPC
  const { data, error } = await supabase.rpc('import_los_members', { rows })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Rebuild LTree paths after import
  await supabase.rpc('rebuild_tree_paths')

  return Response.json(data)
}