import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * PATCH /api/admin/members/verify/[id]
 *
 * approve path:
 *   Enqueues a 'verification/approve' Inngest event and returns 202.
 *   All DB writes, Clerk sync, and notifications happen inside the Inngest job.
 *   approve_member_verification RPC is DEPRECATED — retained as fallback only.
 *
 * deny path:
 *   Synchronous — no external API calls, no atomicity risk. Handled in-route.
 *
 * inngest is imported dynamically inside the approve branch to prevent
 * decodeURIComponent crash during Next.js build-time page data collection
 * (INNGEST_EVENT_KEY is absent at build time).
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
  // Approve — enqueue Inngest job, return 202
  // -----------------------------------------------------------------------
  if (action === 'approve') {
    const { data: verReq } = await supabase
      .from('abo_verification_requests')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!verReq)
      return Response.json({ error: 'Request not found' }, { status: 404 })

    if (verReq.status !== 'pending') {
      return Response.json(
        { error: `Cannot approve — status is ${verReq.status}` },
        { status: 409 }
      )
    }

    const { inngest } = await import('@/inngest/client')
    await inngest.send({
      name: 'verification/approve',
      data: {
        requestId: id,
        adminClerkId: userId,
        adminNote: admin_note ?? null,
      },
    })

    return Response.json({ queued: true }, { status: 202 })
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
  const denyContactEmail = profile?.contact_email
  if (!error && denyContactEmail) {
    import('@/lib/email/send').then(({ sendNotificationEmail }) => {
      import('@/lib/email/templates/render').then(({ renderEmailTemplate }) => {
        import('@/lib/email/templates/AboVerificationEmail').then(
          ({ AboVerificationEmail }) => {
            renderEmailTemplate(
              AboVerificationEmail({
                firstName: profile.first_name || 'Member',
                claimedAbo: verReq.claimed_abo,
                status: 'denied',
                adminNote: admin_note,
              })
            )
              .then((html) => {
                sendNotificationEmail({
                  to: denyContactEmail,
                  subject: 'ABO Verification Declined',
                  html,
                  template: 'abo_verification_result',
                  meta: { request_id: id, profile_id: verReq.profile_id },
                }).catch(console.error)
              })
              .catch(console.error)
          }
        ).catch(console.error)
      }).catch(console.error)
    }).catch(console.error)
  }

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
