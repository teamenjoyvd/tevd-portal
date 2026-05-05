import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/supabase/guards'

// Path C: admin directly verifies a guest with no prior submission.
// Always manual (no ABO number) — sets role=member, stores upline_abo_number,
// places a placeholder tree node.
//
// Refactored to go through approve_member_verification RPC — the single
// write gate for all approval paths. Previously this route wrote to profiles
// and tree_nodes directly and upserted abo_verification_requests with
// claimed_abo: null, which could clobber an existing standard request row
// and cause abo_number to remain null after approval.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { profile_id, upline_abo_number } = await req.json()
  if (!profile_id || !upline_abo_number) {
    return Response.json({ error: 'profile_id and upline_abo_number are required' }, { status: 400 })
  }

  // Fetch target profile for Clerk sync and notification copy
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('role, clerk_id, first_name, contact_email')
    .eq('id', profile_id)
    .single()

  if (!targetProfile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (targetProfile.role !== 'guest') return Response.json({ error: 'Profile is not a guest' }, { status: 409 })

  // Resolve the request row to pass to the RPC.
  //
  // Try inserting a new manual request first. On conflict (unique constraint
  // on profile_id — covers pending, denied, and any other non-approved status):
  //   - Update claimed_upline_abo to the admin's provided value so the admin's
  //     intent wins regardless of what the guest submitted.
  //   - Preserve claimed_abo so a pre-existing standard request keeps its ABO
  //     number and the RPC standard path writes it correctly to the profile.
  //   - Reset status to 'pending' and clear resolved_at so the RPC can approve it.
  //
  // The UPDATE is scoped to status != 'approved' as belt-and-suspenders, though
  // the role !== 'guest' guard above already prevents reaching this point for
  // already-approved members.
  const { data: inserted, error: insertErr } = await supabase
    .from('abo_verification_requests')
    .insert({
      profile_id,
      claimed_abo: null,
      claimed_upline_abo: upline_abo_number,
      request_type: 'manual',
      status: 'pending',
      resolved_at: null,
    })
    .select('id')
    .single()

  let requestId: string | null = inserted?.id ?? null

  if (insertErr?.code === '23505') {
    // Conflict: existing request row (any non-approved status).
    // Update upline to admin's value; preserve claimed_abo; reset to pending.
    const { data: updated, error: updateErr } = await supabase
      .from('abo_verification_requests')
      .update({
        claimed_upline_abo: upline_abo_number,
        status: 'pending',
        resolved_at: null,
        admin_note: null,
      })
      .eq('profile_id', profile_id)
      .neq('status', 'approved')
      .select('id')
      .single()

    if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })
    requestId = updated?.id ?? null
  } else if (insertErr) {
    return Response.json({ error: insertErr.message }, { status: 500 })
  }

  if (!requestId) {
    return Response.json({ error: 'Could not resolve verification request row' }, { status: 500 })
  }

  // Approve via RPC — atomic transaction: profiles update + request update + tree node
  const { error: rpcErr } = await supabase
    .rpc('approve_member_verification', {
      p_request_id: requestId,
      p_admin_note: 'Direct verification by admin (Path C)',
    })

  if (rpcErr) return Response.json({ error: rpcErr.message }, { status: 500 })

  // Audit log — app layer only, consistent with Path B
  await supabase.from('role_change_audit').insert({
    profile_id,
    changed_by: userId,
    old_role: 'guest',
    new_role: 'member',
    note: 'direct verify (Path C)',
  })

  // Sync role to Clerk publicMetadata — RPC is pure Postgres, cannot call Clerk
  if (targetProfile.clerk_id) {
    const clerk = await clerkClient()
    await clerk.users.updateUserMetadata(targetProfile.clerk_id, {
      publicMetadata: { role: 'member' },
    })
  }

  // Notify the user. Best-effort.
  if (targetProfile.contact_email) {
    import('@/lib/email/send').then(({ sendNotificationEmail }) => {
      import('@/lib/email/templates/render').then(({ renderEmailTemplate }) => {
        import('@/lib/email/templates/AboVerificationEmail').then(({ AboVerificationEmail }) => {
          renderEmailTemplate(
            AboVerificationEmail({
              firstName: targetProfile.first_name || 'Member',
              claimedAbo: null,
              status: 'approved',
              adminNote: 'Direct verification by admin',
            })
          ).then(html => {
            sendNotificationEmail({
              to: targetProfile.contact_email!,
              subject: 'ABO Verification Approved ✓',
              html,
              template: 'abo_verification_result',
              meta: { profile_id },
            }).catch(console.error)
          }).catch(console.error)
        }).catch(console.error)

        if (targetProfile.role === 'guest') {
          import('@/lib/email/templates/WelcomeEmail').then(({ WelcomeEmail }) => {
            renderEmailTemplate(WelcomeEmail({ firstName: targetProfile.first_name || 'Member' }))
              .then(html => {
                sendNotificationEmail({
                  to: targetProfile.contact_email!,
                  subject: 'Welcome to Team Enjoy VD!',
                  html,
                  template: 'abo_verification_result',
                  meta: { profile_id },
                }).catch(console.error)
              }).catch(console.error)
          }).catch(console.error)
        }
      }).catch(console.error)
    }).catch(console.error)
  }

  // Read back the resolved request for the response
  const { data, error } = await supabase
    .from('abo_verification_requests')
    .select()
    .eq('id', requestId)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
