import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/supabase/guards'

// ── POST — purge LOS members absent from the provided ABO set ─────────────────
//
// Accepts the full assembled ABO set from the client (all abo_numbers present
// in the currently loaded files). Deletes every los_members row whose
// abo_number is NOT in that set. Records a rollback-able snapshot.
//
// This is intentionally separate from the import flow. Import first, purge
// second — never the reverse.

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { keep_abos } = await req.json()

  if (!Array.isArray(keep_abos) || keep_abos.length === 0) {
    return Response.json({ error: 'keep_abos must be a non-empty array' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('purge_absent_los_members', {
    p_keep_abos: keep_abos,
    p_imported_by: undefined,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const result = data as { removed: number; import_id: string }

  return Response.json({
    removed: result.removed,
    import_id: result.import_id,
  })
}
