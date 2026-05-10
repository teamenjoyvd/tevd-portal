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
 *   Calls approve_member_verification RPC (SECURITY DEFINER, service_role).
 *   Syncs role to Clerk publicMetadata.
 *   Sends approval + welcome emails via sendTransactionalEmail.
 *   All steps awaited — returns 200 with resolved request data.
 *
 * deny path:
 *   Synchronous — no external API calls. Updates status to 'denied',
 *   inserts in-app notification, sends denial email.
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
  // Approve — synchronous: RPC → Clerk sync → emails → 200
  // -----------------------------------------------------------------------
  if (action === 'approve') {
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

    // Clerk sync
    const { data: profile } = await supabase
      .from('profiles')
      .select('clerk_id, first_name, contact_email, role')
      .eq('id', result.profile_id)
      .single()

    if (profile?.clerk_id) {
      const clerk = await clerkClient()
      await clerk.users.updateUserMetadata(profile.clerk_id, {
        publicMetadata: { role: 'member' },
      })
    }

    // Fetch the original request for email context
    const { data: verReq } = await supabase
      .from('abo_verification_requests')
      .select('claimed_abo, request_type')
      .eq('id', id)
      .single()

    // Approval email
    if (profile?.contact_email) {
      const approvalHtml = await renderEmailTemplate(
        AboVerificationEmail({
          firstName: profile.first_name || 'Member',
          claimedAbo: verReq?.claimed_abo ?? null,
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

      // Welcome email for first-time promotions from guest
      if (verReq?.request_type !== 'manual' || !result.role) {
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

    // In-app notification
    const notifMessage =
      verReq?.request_type === 'manual'
        ? `Welcome ${profile?.first_name ?? ''}! Your manual verification has been approved. You are now a Member.`
        : `Welcome ${profile?.first_name ?? ''}! Your ABO number ${verReq?.claimed_abo} has been verified. You are now a Member.`

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
