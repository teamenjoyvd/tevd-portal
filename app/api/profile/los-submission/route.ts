import { auth } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkSubmissionRoot } from '@/lib/csv-import'

// CORE self-service LOS submissions. Uploads are staged as `pending` here for
// admin review — this route never writes to los_members.

const ROOT_ERROR: Record<string, string> = {
  'no-root': 'Your file has no single tree root (it may be cyclic). Export your full downline and try again.',
  'multi-root': 'Your file contains more than one top node. Upload only your own connected sub-tree.',
  'mismatch': 'The top of your uploaded tree does not match your ABO number.',
}

async function callerProfile(userId: string, supabase: ReturnType<typeof createServiceClient>) {
  const { data } = await supabase
    .from('profiles')
    .select('id, role, abo_number')
    .eq('clerk_id', userId)
    .single()
  return data
}

// ── GET — caller's own submissions ────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const profile = await callerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('los_submission_requests')
    .select('id, root_abo_number, row_count, status, admin_note, created_at, resolved_at')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ submissions: data ?? [], abo_number: profile.abo_number })
}

// ── POST — stage a new submission (scope-guarded, server-enforced) ─────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const profile = await callerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  if (profile.role !== 'core' && profile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!profile.abo_number) {
    return Response.json({ error: 'Verify your ABO number before submitting.' }, { status: 400 })
  }

  const { rows } = await req.json().catch(() => ({ rows: null }))
  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: 'No rows provided' }, { status: 400 })
  }

  // Scope guard — never trust the client's check.
  const check = checkSubmissionRoot(rows as Record<string, string>[], profile.abo_number)
  if (!check.ok) {
    return Response.json(
      { error: ROOT_ERROR[check.reason], reason: check.reason, roots: check.roots },
      { status: 400 },
    )
  }

  // Supersede any prior still-pending submission from this owner.
  await supabase
    .from('los_submission_requests')
    .update({ status: 'withdrawn', resolved_at: new Date().toISOString() })
    .eq('profile_id', profile.id)
    .eq('status', 'pending')

  const { data, error } = await supabase
    .from('los_submission_requests')
    .insert({
      profile_id: profile.id,
      root_abo_number: check.root,
      rows: rows as unknown as never,
      row_count: rows.length,
      status: 'pending',
    })
    .select('id, root_abo_number, row_count, status, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ submission: data })
}

// ── PATCH — withdraw own pending submission ───────────────────────────────────

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const profile = await callerProfile(userId, supabase)
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { id } = await req.json().catch(() => ({ id: null }))
  if (!id) return Response.json({ error: 'Missing submission id' }, { status: 400 })

  const { data, error } = await supabase
    .from('los_submission_requests')
    .update({ status: 'withdrawn', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('profile_id', profile.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'No pending submission to withdraw' }, { status: 404 })
  return Response.json({ ok: true })
}
