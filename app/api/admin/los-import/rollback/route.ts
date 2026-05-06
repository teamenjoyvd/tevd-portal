import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/supabase/guards'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { import_id } = await req.json()

  if (!import_id) {
    return Response.json({ error: 'import_id required' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('rollback_los_import', {
    p_import_id: import_id,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}
