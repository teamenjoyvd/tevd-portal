import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTransactionalEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { AboVerificationEmail } from '@/lib/email/templates/AboVerificationEmail'
import { WelcomeEmail } from '@/lib/email/templates/WelcomeEmail'
import type { Json } from '@/types/supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function logEvent(
  supabase: ReturnType<typeof createServiceClient>,
  opts: {
    actor_id: string
    subject_id: string | null
    event_type: string
    payload?: Record<string, unknown>
    status?: string
  }
) {
  await supabase.from('member_event_log').insert({
    actor_id: opts.actor_id,
    subject_id: opts.subject_id,
    event_type: opts.event_type,
    payload: (opts.payload ?? {}) as Json,
    status: opts.status ?? 'ok',
  })
}

// ---------------------------------------------------------------------------
// POST — submit ABO verification
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, abo_number, primary_profile_id, first_name, contact_email')
    .eq('clerk_id', userId)
    .single()

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Guard: secondary accounts cannot submit ABO verification
  if (profile.primary_profile_id) {
    return Response.json(
      {
        error: 'Secondary accounts cannot submit ABO verification',
        error_code: 'secondary_cannot_verify',
      },
      { status: 400 }
    )
  }

  if (profile.abo_number) return Response.json({ error: 'ABO already verified' }, { status: 409 })
  if (profile.role !== 'guest') return Response.json({ error: 'Already verified' }, { status: 409 })

  const body = await req.json()

  // Manual path removed — 400 if submitted
  if (body.request_type === 'manual') {
    return Response.json(
      { error: 'Manual verification requests are no longer accepted via this endpoint.' },
      { status: 400 }
    )
  }

  const { claimed_abo, claimed_upline_abo } = body

  if (!claimed_abo || !claimed_upline_abo) {
    return Response.json(
      { error: 'claimed_abo and claimed_upline_abo are required' },
      { status: 400 }
    )
  }

  // LOS existence check
  const { data: losMember } = await supabase
    .from('los_members')
    .select('abo_number, sponsor_abo_number, last_synced_at')
    .eq('abo_number', claimed_abo)
    .maybeSingle()

  if (!losMember) {
    const { data: anyLos } = await supabase
      .from('los_members')
      .select('last_synced_at')
      .order('last_synced_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const losAge = anyLos?.last_synced_at
      ? Math.floor((Date.now() - new Date(anyLos.last_synced_at).getTime()) / 86_400_000)
      : null

    await logEvent(supabase, {
      actor_id: userId,
      subject_id: profile.id,
      event_type: 'abo_verify_failed',
      payload: { claimed_abo, claimed_upline_abo, error_code: 'abo_not_in_los', los_age_days: losAge },
      status: 'failed',
    })

    return Response.json(
      {
        error: losAge !== null
          ? `ABO ${claimed_abo} not found in LOS data (${losAge} days old). Check your number or ask your admin to re-import the LOS.`
          : `ABO ${claimed_abo} not found in LOS data. Ask your admin to import the LOS.`,
        error_code: 'abo_not_in_los',
      },
      { status: 422 }
    )
  }

  // Sponsor mismatch check
  if (losMember.sponsor_abo_number !== claimed_upline_abo) {
    await logEvent(supabase, {
      actor_id: userId,
      subject_id: profile.id,
      event_type: 'abo_verify_failed',
      payload: {
        claimed_abo,
        claimed_upline_abo,
        los_sponsor: losMember.sponsor_abo_number,
        error_code: 'upline_mismatch',
      },
      status: 'failed',
    })
    return Response.json(
      { error: `Your sponsor ABO does not match the LOS record for ${claimed_abo}.`, error_code: 'upline_mismatch' },
      { status: 422 }
    )
  }

  // Duplicate ABO check
  const { data: existingHolder } = await supabase
    .from('profiles')
    .select('id, primary_profile_id')
    .eq('abo_number', claimed_abo)
    .neq('id', profile.id)
    .maybeSingle()

  if (existingHolder) {
    if (existingHolder.primary_profile_id === null) {
      await logEvent(supabase, {
        actor_id: userId,
        subject_id: profile.id,
        event_type: 'abo_verify_failed',
        payload: { claimed_abo, claimed_upline_abo, error_code: 'abo_has_primary', existing_profile_id: existingHolder.id },
        status: 'failed',
      })
      return Response.json(
        {
          error: 'This ABO is already registered. If you are the co-owner, use the Spouse Link option on your profile.',
          error_code: 'abo_has_primary',
          primary_profile_id: existingHolder.id,
        },
        { status: 409 }
      )
    }
    await logEvent(supabase, {
      actor_id: userId,
      subject_id: profile.id,
      event_type: 'abo_verify_failed',
      payload: { claimed_abo, claimed_upline_abo, error_code: 'abo_already_claimed', existing_profile_id: existingHolder.id },
      status: 'failed',
    })
    return Response.json(
      { error: `ABO ${claimed_abo} is already registered to another account.`, error_code: 'abo_already_claimed' },
      { status: 409 }
    )
  }

  // ---------------------------------------------------------------------------
  // LOS match confirmed — insert request row then auto-approve
  // ---------------------------------------------------------------------------

  const { data: requestRow, error: insertError } = await supabase
    .from('abo_verification_requests')
    .upsert(
      {
        profile_id: profile.id,
        claimed_abo,
        claimed_upline_abo,
        request_type: 'standard',
        status: 'pending',
        resolved_at: null,
      },
      { onConflict: 'profile_id' }
    )
    .select()
    .single()

  if (insertError || !requestRow) {
    return Response.json({ error: insertError?.message ?? 'Failed to create request' }, { status: 500 })
  }

  // Call RPC — DB transaction commits here
  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    'approve_member_verification',
    { p_request_id: requestRow.id }
  )

  if (rpcError) {
    await logEvent(supabase, {
      actor_id: 'system',
      subject_id: profile.id,
      event_type: 'abo_verify_failed',
      payload: { claimed_abo, claimed_upline_abo, rpc_error: rpcError.message, error_code: rpcError.code },
      status: 'failed',
    })
    return Response.json({ error: rpcError.message }, { status: 500 })
  }

  const result = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows

  // Log success
  await logEvent(supabase, {
    actor_id: 'system',
    subject_id: profile.id,
    event_type: 'abo_verified',
    payload: { claimed_abo, claimed_upline_abo, request_id: requestRow.id },
    status: 'ok',
  })

  // Post-commit: Clerk sync + emails (try/catch — DB already committed)
  try {
    const clerk = await clerkClient()
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { role: 'member' },
    })

    await logEvent(supabase, {
      actor_id: 'system',
      subject_id: profile.id,
      event_type: 'clerk_sync_ok',
      payload: { clerk_id: userId },
    })
  } catch (clerkErr) {
    console.error('[verify-abo] Clerk sync failed:', clerkErr)
    await logEvent(supabase, {
      actor_id: 'system',
      subject_id: profile.id,
      event_type: 'clerk_sync_failed',
      payload: { clerk_id: userId, error: String(clerkErr) },
      status: 'failed',
    })
  }

  if (profile.contact_email) {
    try {
      const approvalHtml = await renderEmailTemplate(
        AboVerificationEmail({
          firstName: profile.first_name || 'Member',
          claimedAbo: claimed_abo,
          status: 'approved',
          adminNote: null,
        })
      )
      await sendTransactionalEmail({
        to: profile.contact_email,
        subject: 'ABO Verification Approved ✓',
        html: approvalHtml,
        template: 'abo_verification_result',
        meta: { request_id: requestRow.id, profile_id: profile.id },
      })

      // Welcome email — always a guest-to-member promotion on this path
      const welcomeHtml = await renderEmailTemplate(
        WelcomeEmail({ firstName: profile.first_name || 'Member' })
      )
      await sendTransactionalEmail({
        to: profile.contact_email,
        subject: 'Welcome to Team Enjoy VD!',
        html: welcomeHtml,
        template: 'welcome_email',
        meta: { request_id: requestRow.id, profile_id: profile.id },
      })
    } catch (emailErr) {
      console.error('[verify-abo] email failed:', emailErr)
    }
  }

  // In-app notification
  const { error: notifyError } = await supabase.from('notifications').insert({
    profile_id: profile.id,
    type: 'role_request',
    title: 'ABO Verification Approved',
    message: `Your ABO number ${claimed_abo} has been verified. You are now a Member.`,
    action_url: '/profile',
  })
  if (notifyError) console.error('[verify-abo] notification failed:', notifyError)

  return Response.json({ status: 'approved', result })
}

// ---------------------------------------------------------------------------
// DELETE — cancel a pending request
// ---------------------------------------------------------------------------

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { error } = await supabase
    .from('abo_verification_requests')
    .delete()
    .eq('profile_id', profile.id)
    .eq('status', 'pending')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cancelled: true })
}

// ---------------------------------------------------------------------------
// GET — fetch current request status
// ---------------------------------------------------------------------------

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('abo_verification_requests')
    .select('*')
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
