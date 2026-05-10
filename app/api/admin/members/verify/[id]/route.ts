import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTransactionalEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { AboVerificationEmail } from '@/lib/email/templates/AboVerificationEmail'
import { WelcomeEmail } from '@/lib/email/templates/WelcomeEmail'

/**
 * PATCH /api/admin/members/verify/[id]
 *
 * approve path:
 *   1. Read pre-promotion profile role (for welcome-email gate).
 *   2. Call approve_member_verification RPC (SECURITY DEFINER, service_role).
 *      DB transaction commits here — this is the point of no return.
 *   3. Clerk publicMetadata sync + emails in a try/catch.
 *      Failures are logged but do NOT produce a 500 — the DB has already
 *      committed, so a 500 would be misleading. Clerk drift is reconcilable
 *      via manual admin action.
 *   Returns 200 with the resolved RPC result row.
 *
 * deny path:
 *   Synchronous — updates status to 'denied', inserts in-app notification,
 *   sends denial email via sendTransactionalEmail.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: admin } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()
  if (admin?.role !== 'admin')
    return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { action, admin_note } = await req.json()
  if (!['approve', 'deny'].includes(action)) {
    return Response.json(
      { error: 'action must be approve or deny' },
      { status: 400 }
    )
  }

  // -----------------------------------------------------------------------
  // Approve — synchronous: pre-read → RPC → Clerk sync → emails → 200
  // -----------------------------------------------------------------------
  if (action === 'approve') {
    // Read profile + request before the RPC so we have pre-promotion state.
    // profile.role here is the role BEFORE the RPC promotes it to 'member'.
    const [{ data: preProfile }, { data: verReq }] = await Promise.all([
      supabase
        .from('profiles')
        .select('clerk_id, first_name, contact_email, role')
        .eq('id',
          // profile_id must be resolved via the verification request
          supabase
            .from('abo_verification_requests')
            .select('profile_id')
            .eq('id', id)
            .single()
            .then(({ data }) => data?.profile_id ?? '')
        )
        .single(),
      supabase
        .from('abo_verification_requests')
        .select('profile_id, claimed_abo, request_type')
        .eq('id', id)
        .single(),
    ])

    // Simple sequential pre-read (Promise.all above is awkward with a derived FK).
    // Re-fetch cleanly:
    const { data: preReq } = await supabase
      .from('abo_verification_requests')
      .select('profile_id, claimed_abo, request_type')
      .eq('id', id)
      .single()

    const { data: profile } = await supabase
      .from('profiles')
      .select('clerk_id, first_name, contact_email, role')
      .eq('id', preReq?.profile_id ?? '')
      .single()

    // Capture pre-promotion role for welcome-email gate.
    const wasGuest = profile?.role === 'guest'

    // --- RPC: DB transaction commits here ---
    const { data: rpcRows, error: rpcError } = await supabase.rpc(
      'approve_member_verification',
      { p_request_id: id, p_admin_note: admin_note ?? null }
    )

    if (rpcError) {
      if (rpcError.code === '23505') {
        return Response.json(
          { error: 'Request is already approved' },
          { status: 409 }
        )
      }
      return Response.json({ error: rpcError.message }, { status: 500 })
    }

    const result = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
    if (!result) {
      return Response.json({ error: 'Request not found' }, { status: 404 })
    }

    // --- Post-commit: Clerk sync + emails ---
    // Failures here are logged but never propagate a 500 — the DB has committed.
    try {
      if (profile?.clerk_id) {
        const clerk = await clerkClient()
        await clerk.users.updateUserMetadata(profile.clerk_id, {
          publicMetadata: { role: 'member' },
        })
      }

      if (profile?.contact_email) {
        const approvalHtml = await renderEmailTemplate(
          AboVerificationEmail({
            firstName: profile.first_name || 'Member',
            claimedAbo: preReq?.claimed_abo ?? null,
            status: 'approved',
            adminNote: admin_note ?? null,
          })
        )
        await sendTransactionalEmail({
          to: profile.contact_email,
          subject: 'ABO Verification Approved ✓',
          html: approvalHtml,
          template: 'abo_verification_result',
          meta: { request_id: id, profile_id: result.profile_id },
        })

        // Welcome email only for users promoted from guest.
        if (wasGuest) {
          const welcomeHtml = await renderEmailTemplate(
            WelcomeEmail({ firstName: profile.first_name || 'Member' })
          )
          await sendTransactionalEmail({
            to: profile.contact_email,
            subject: 'Welcome to Team Enjoy VD!',
            html: welcomeHtml,
            template: 'abo_verification_result',
            meta: { request_id: id, profile_id: result.profile_id },
          })
        }
      }
    } catch (postCommitErr) {
      // DB is committed — log and continue. Admin can re-trigger Clerk sync
      // manually if needed; do not surface as 500.
      console.error('[approve] post-commit step failed:', postCommitErr)
    }

    // In-app notification (best-effort, outside the try/catch — non-critical)
    const notifMessage =
      preReq?.request_type === 'manual'
        ? `Welcome ${profile?.first_name ?? ''}! Your manual verification has been approved. You are now a Member.`
        : `Welcome ${profile?.first_name ?? ''}! Your ABO number ${preReq?.claimed_abo} has been verified. You are now a Member.`

    await supabase.from('notifications').insert({
      profile_id: result.profile_id,
      type: 'role_request',
      title: 'Verification approved',
      message: notifMessage,
      action_url: '/profile',
    })

    return Response.json(result)
  }

  // -----------------------------------------------------------------------
  // Deny — synchronous, in-route
  // -----------------------------------------------------------------------
  const { data: verReq } = await supabase
    .from('abo_verification_requests')
    .select('*, profile:profiles(id, role, first_name, contact_email)')
    .eq('id', id)
    .single()

  if (!verReq)
    return Response.json({ error: 'Request not found' }, { status: 404 })

  await supabase.from('notifications').insert({
    profile_id: verReq.profile_id,
    type: 'role_request',
    title: 'ABO verification not approved',
    message: admin_note
      ? `Your verification request was not approved: ${admin_note}`
      : 'Your ABO verification request was not approved. Please check your details and try again.',
    action_url: '/profile',
  })

  const { data, error } = await supabase
    .from('abo_verification_requests')
    .update({
      status: 'denied',
      resolved_at: new Date().toISOString(),
      admin_note: admin_note ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  const profile = verReq.profile as {
    id: string
    role: string
    first_name: string | null
    contact_email: string | null
  }

  if (!error && profile?.contact_email) {
    const denyHtml = await renderEmailTemplate(
      AboVerificationEmail({
        firstName: profile.first_name || 'Member',
        claimedAbo: verReq.claimed_abo,
        status: 'denied',
        adminNote: admin_note ?? null,
      })
    )
    await sendTransactionalEmail({
      to: profile.contact_email,
      subject: 'ABO Verification Declined',
      html: denyHtml,
      template: 'abo_verification_result',
      meta: { request_id: id, profile_id: verReq.profile_id },
    })
  }

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
