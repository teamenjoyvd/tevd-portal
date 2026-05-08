import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { id: requestId } = await params
  const body = await req.json()
  const { status, admin_note } = body

  if (!status || !['approved', 'denied'].includes(status)) {
    return Response.json({ error: 'status must be approved or denied' }, { status: 400 })
  }
  if (status === 'denied' && !admin_note?.trim()) {
    return Response.json({ error: 'admin_note is required when denying' }, { status: 400 })
  }

  // Fetch the request
  const { data: request } = await supabase
    .from('spouse_link_requests')
    .select('id, status, requester_id, claimed_primary_id')
    .eq('id', requestId)
    .single()
  if (!request) return Response.json({ error: 'Request not found' }, { status: 404 })
  if (request.status !== 'pending') {
    return Response.json({ error: 'Request is no longer pending' }, { status: 409 })
  }

  if (status === 'denied') {
    const { error } = await supabase
      .from('spouse_link_requests')
      .update({ status: 'denied', admin_note, resolved_at: new Date().toISOString() })
      .eq('id', requestId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ status: 'denied' })
  }

  // --- APPROVE path ---
  // Re-verify all guards at approval time (not just submission time)

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

  // Guard 2: claimed_primary must be a verified member, with abo_number, and itself a primary
  const { data: primary } = await supabase
    .from('profiles')
    .select('id, role, abo_number, primary_profile_id')
    .eq('id', request.claimed_primary_id)
    .single()
  if (!primary) return Response.json({ error: 'Primary profile not found' }, { status: 404 })
  if (primary.role === 'guest') {
    return Response.json(
      { error: 'Primary profile is not a verified member.', error_code: 'primary_not_member' },
      { status: 409 }
    )
  }
  if (!primary.abo_number) {
    return Response.json(
      { error: 'Primary profile has no ABO number.', error_code: 'primary_no_abo' },
      { status: 409 }
    )
  }
  if (primary.primary_profile_id) {
    return Response.json(
      { error: 'Primary profile is itself a secondary account.', error_code: 'primary_is_secondary' },
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
      { error: 'Primary already has a linked spouse account.', error_code: 'primary_has_secondary' },
      { status: 409 }
    )
  }

  // Atomic writes
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      primary_profile_id: primary.id,
      abo_number: primary.abo_number,
      role: 'member',
    })
    .eq('id', requester.id)
  if (profileErr) return Response.json({ error: profileErr.message }, { status: 500 })

  const { error: requestErr } = await supabase
    .from('spouse_link_requests')
    .update({ status: 'approved', admin_note: admin_note ?? null, resolved_at: new Date().toISOString() })
    .eq('id', requestId)
  if (requestErr) return Response.json({ error: requestErr.message }, { status: 500 })

  // Audit log
  await supabase.from('role_change_audit').insert({
    profile_id: requester.id,
    changed_by: userId,
    old_role: 'guest',
    new_role: 'member',
    note: 'Spouse link approval',
  })

  // Sync Clerk metadata
  if (requester.clerk_id) {
    const clerk = await clerkClient()
    await clerk.users.updateUserMetadata(requester.clerk_id, {
      publicMetadata: { role: 'member' },
    })
  }

  // Welcome email — best-effort
  if (requester.contact_email) {
    import('@/lib/email/send').then(({ sendNotificationEmail }) => {
      import('@/lib/email/templates/render').then(({ renderEmailTemplate }) => {
        import('@/lib/email/templates/WelcomeEmail').then(({ WelcomeEmail }) => {
          renderEmailTemplate(WelcomeEmail({ firstName: requester.first_name || 'Member' }))
            .then(html => {
              sendNotificationEmail({
                to: requester.contact_email!,
                subject: 'Welcome to Team Enjoy VD!',
                html,
                template: 'abo_verification_result',
                meta: { profile_id: requester.id },
              }).catch(console.error)
            }).catch(console.error)
        }).catch(console.error)
      }).catch(console.error)
    }).catch(console.error)
  }

  return Response.json({ status: 'approved' }, { status: 200 })
}
