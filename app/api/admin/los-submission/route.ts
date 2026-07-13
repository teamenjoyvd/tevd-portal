import { auth } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { mergeSubmissions, type SubmissionInput } from '@/lib/csv-import'

// Admin review of staged CORE LOS submissions. Approve merges the selected parts
// (deepest-owner-wins) and runs the existing import_los_members RPC; reject
// declines one. The actual los_members write stays in this route (one import).

// ── GET — pending + recently resolved submissions with submitter info ──────────

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { guard } = await getCallerContext(userId, supabase, 'admin')
  if (guard) return guard

  const { data, error } = await supabase
    .from('los_submission_requests')
    .select('id, root_abo_number, row_count, status, admin_note, created_at, resolved_at, profiles!los_submission_requests_profile_id_fkey(first_name, last_name, abo_number)')
    .in('status', ['pending', 'approved', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ submissions: data ?? [] })
}

// ── POST — approve (merge + import) or reject ─────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { profile, guard } = await getCallerContext(userId, supabase, 'admin')
  if (guard) return guard

  const body = await req.json().catch(() => ({}))
  const action = body?.action as 'approve' | 'reject' | undefined

  // ── Reject ────────────────────────────────────────────────────────────────
  if (action === 'reject') {
    const id = body?.id as string | undefined
    if (!id) return Response.json({ error: 'Missing submission id' }, { status: 400 })
    const { error } = await supabase.rpc('reject_los_submission', {
      p_id: id,
      p_note: body?.note ?? null,
      p_resolved_by: profile.id,
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // ── Approve ─────────────────────────────────────────────────────────────────
  if (action !== 'approve') {
    return Response.json({ error: 'Unknown action' }, { status: 400 })
  }

  const ids = body?.ids as string[] | undefined
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: 'No submissions selected' }, { status: 400 })
  }

  const { data: subs, error: loadError } = await supabase
    .from('los_submission_requests')
    .select('id, root_abo_number, created_at, rows, status')
    .in('id', ids)

  if (loadError) return Response.json({ error: loadError.message }, { status: 500 })
  const pending = (subs ?? []).filter(s => s.status === 'pending')
  if (pending.length === 0) {
    return Response.json({ error: 'No pending submissions in selection' }, { status: 400 })
  }

  // Merge the selected parts — deepest-owner-wins per ABO.
  const inputs: SubmissionInput[] = pending.map(s => ({
    rootAbo: s.root_abo_number,
    createdAt: s.created_at,
    rows: (s.rows as unknown as Record<string, string>[]) ?? [],
  }))
  const merged = mergeSubmissions(inputs)

  if (merged.rows.length === 0) {
    return Response.json({ error: 'Merged submission is empty' }, { status: 400 })
  }

  // Run the single authoritative import (upsert-only) via the existing RPC.
  const { data: importData, error: importError } = await supabase.rpc('import_los_members', {
    p_rows: merged.rows as unknown as never,
    p_imported_by: profile.id,
  })
  if (importError) return Response.json({ error: importError.message }, { status: 500 })

  // Transition the approved submissions.
  const approvedIds = pending.map(s => s.id)
  const { error: approveError } = await supabase.rpc('approve_los_submissions', {
    p_ids: approvedIds,
    p_resolved_by: profile.id,
  })
  if (approveError) return Response.json({ error: approveError.message }, { status: 500 })

  const rpcResult = importData as { inserted: number; import_id: string; errors: unknown[] }
  return Response.json({
    inserted: rpcResult.inserted,
    import_id: rpcResult.import_id,
    approved: approvedIds.length,
    junctions: merged.junctions,
    conflicts: merged.conflicts,
    row_count: merged.rows.length,
  })
}
