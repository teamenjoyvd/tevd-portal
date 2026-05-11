import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotificationEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { WelcomeEmail } from '@/lib/email/templates/WelcomeEmail'

// POST /api/profile/spouse-link/approve
// POST /api/profile/spouse-link/deny
// Called by the primary member. Body: { request_id: string, deny_note?: string }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params
  if (action !== 'approve' && action !== 'deny') {
    return Response.json({ error: 'Invalid action' }, { status: 404 })
  }

  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  // member_event_log and role_change_audit are not yet in generated Supabase types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Resolve caller profile
  const { data: caller } = await supabase
    .from('profiles')
    .select('id, role, primary_profile_id')
    .eq('clerk_id', userId)
    .single()
  if (!caller) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Caller must be a primary member (member, no primary_profile_id)
  if (caller.role === 'guest') {
    return Response.json({ error: 'Only verified members can act on spouse link requests' }, { status: 403 })
  }
  if (caller.primary_profile_id) {
    return Response.json({ error: 'Secondary accounts cannot act on spouse link requests' }, { status: 403 })
  }

  const body = await req.json()
  const { request_id, deny_note } = body
  if (!request_id) return Response.json({ error: 'request_id is required' }, { status: 400 })
  if (action === 'deny' && !deny_note?.trim()) {
    return Response.json({ error: 'deny_note is required when denying' }, { status: 400 })
  }

  // Fetch the request — verify claimed_primary_id matches caller
  const { data: request } = await supabase
    .from('spouse_link_requests')
    .select('id, status, requester_id, claimed_primary_id')
    .eq('id', request_id)
    .single()
  if (!request) return Response.json({ error: 'Request not found' }, { status: 404 })
  if (request.claimed_primary_id !== caller.id) {
    return Response.json({ error: 'You are not the primary for this request' }, { status: 403 })
  }
  if (request.status !== 'pending') {
    return Response.json({ error: 'Request is no longer pending' }, { status: 409 })
  }

  // ── DENY ──────────────────────────────────────────────────────────────────
  if (action === 'deny') {
    const { error } = await supabase
      .from('spouse_link_requests')
      .update({ status: 'denied', admin_note: deny_note.trim(), resolved_at: new Date().toISOString() })
      .eq('id', request_id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    await db.from('member_event_log').insert({
      actor_id: userId,
      subject_id: request.requester_id,
      event_type: 'spouse_link_denied',
      payload: { request_id, denied_by: caller.id },
    })

    return Response.json({ status: 'denied' })
  }

  // ── APPROVE ───────────────────────────────────────────────────────────────
  // Re-verify all guards at approval time

  // Guard 1: requester must still be a guest with no primary_profile_id
  const { data: requester } = await supabase
    .from('profiles')
    .select('id, role, primary_profile_id, clerk_id, first_name, contact_email')
    .eq('id', request.requester_id)
    .single()
  if (!requester) return Response.json({ error: 'Requester profile not found' }, { status: 404 })
  if (requester.role !== 'guest') {
    return Response.json(
      { error: 'Requester is no longer a guest. Cannot approve.', error_code: 'requester_not_guest' },
      { status: 409 }
    )
  }
  if (requester.primary_profile_id) {
    return Response.json(
      { error: 'Requester is already linked as a spouse.', error_code: 'requester_already_linked' },
      { status: 409 }
    )
  }

  // Guard 2: caller (primary) must still be a verified member with abo_number, itself a primary
  const { data: primary } = await supabase
    .from('profiles')
    .select('id, role, abo_number, primary_profile_id')
    .eq('id', caller.id)
    .single()
  if (!primary) return Response.json({ error: 'Primary profile not found' }, { status: 404 })
  if (primary.role === 'guest') {
    return Response.json(
      { error: 'Your account is not a verified member.', error_code: 'primary_not_member' },
      { status: 409 }
    )
  }
  if (!primary.abo_number) {
    return Response.json(
      { error: 'Your account has no ABO number.', error_code: 'primary_no_abo' },
      { status: 409 }
    )
  }
  if (primary.primary_profile_id) {
    return Response.json(
      { error: 'Your account is itself a secondary account.', error_code: 'primary_is_secondary' },
      { status: 409 }
    )
  }

  // Guard 3: primary must have no existing secondary
  const { data: existingSecondary } = await supabase
    .from('profiles')
    .select('id')
    .eq('primary_profile_id', primary.id)
    .maybeSingle()
  if (existingSecondary) {
    return Response.json(
      { error: 'You already have a linked spouse account.', error_code: 'primary_has_secondary' },
      { status: 409 }
    )
  }

  // Atomic writes
  // Note: abo_number is intentionally NOT copied to the secondary profile row.
  // The UNIQUE constraint on profiles.abo_number means only one row can hold a given
  // value. The secondary's ABO number is derivable by joining through primary_profile_id.
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      primary_profile_id: primary.id,
      role: 'member',
    })
    .eq('id', requester.id)
  if (profileErr) return Response.json({ error: profileErr.message }, { status: 500 })

  const { error: requestErr } = await supabase
    .from('spouse_link_requests')
    .update({ status: 'approved', admin_note: null, resolved_at: new Date().toISOString() })
    .eq('id', request_id)
  if (requestErr) return Response.json({ error: requestErr.message }, { status: 500 })

  // Audit log
  await db.from('role_change_audit').insert({
    profile_id: requester.id,
    changed_by: userId,
    old_role: 'guest',
    new_role: 'member',
    note: 'Spouse link approval by primary member',
  })

  // Event log
  await db.from('member_event_log').insert([
    {
      actor_id: userId,
      subject_id: requester.id,
      event_type: 'spouse_link_approved',
      payload: { request_id, approved_by: caller.id },
    },
  ])

  // Sync Clerk metadata — awaited so the serverless function does not exit
  // before the role is visible to the user's next session.
  if (requester.clerk_id) {
    const clerk = await clerkClient()
    try {
      await clerk.users.updateUserMetadata(requester.clerk_id, {
        publicMetadata: { role: 'member' },
      })
      await db.from('member_event_log').insert({
        actor_id: userId,
        subject_id: requester.id,
        event_type: 'clerk_sync_ok',
        payload: { context: 'spouse_link_approve' },
      })
    } catch (err: unknown) {
      await db.from('member_event_log').insert({
        actor_id: userId,
        subject_id: requester.id,
        event_type: 'clerk_sync_failed',
        payload: { context: 'spouse_link_approve', error: String(err) },
      })
    }
  }

  // Welcome email — best-effort, non-blocking
  if (requester.contact_email) {
    renderEmailTemplate(
      WelcomeEmail({ firstName: requester.first_name || 'Member' })
    ).then(html =>
      sendNotificationEmail({
        to: requester.contact_email!,
        subject: 'Welcome to Team Enjoy VD!',
        html,
        template: 'abo_verification_result',
        meta: { profile_id: requester.id },
      })
    ).catch(console.error)
  }

  return Response.json({ status: 'approved' })
}
