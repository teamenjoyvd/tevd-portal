import { inngest } from '@/inngest/client'
import sql from '@/lib/db/client'
import { clerkClient } from '@clerk/nextjs/server'

export type ApproveVerificationEvent = {
  name: 'verification/approve'
  data: {
    requestId: string
    adminClerkId: string
    adminNote: string | null
  }
}

/**
 * 3-step Inngest function for the member verification approval workflow.
 *
 * Step 1: DB transaction via postgres.js (direct connection).
 *   - Replicates all logic from approve_member_verification RPC.
 *   - Idempotency guard: skip if request is already resolved.
 *   - Returns profile data needed by subsequent steps.
 *
 * Step 2: Clerk publicMetadata sync.
 *   - Updates role to 'member' in Clerk.
 *   - Retried automatically by Inngest on failure — Step 1 is not re-run.
 *
 * Step 3: Notifications + email (fire-and-forget within job).
 *   - Inserts in-app notification.
 *   - Sends approval emails via sendNotificationEmail.
 *   - Failure here does not roll back Steps 1 or 2.
 */
export const approveVerification = inngest.createFunction(
  {
    id: 'approve-verification',
    retries: 3,
  },
  { event: 'verification/approve' },
  async ({ event, step }) => {
    const { requestId, adminClerkId, adminNote } = event.data
    const inngestEventId: string | null = event.id ?? null

    // -----------------------------------------------------------------------
    // Step 1: DB transaction
    // -----------------------------------------------------------------------
    const dbResult = await step.run('db-transaction', async () => {
      const rows = await sql`
        SELECT
          r.id,
          r.status,
          r.request_type,
          r.claimed_abo,
          r.profile_id,
          p.clerk_id,
          p.first_name,
          p.contact_email,
          p.role AS current_role
        FROM abo_verification_requests r
        JOIN profiles p ON p.id = r.profile_id
        WHERE r.id = ${requestId}
        LIMIT 1
      `

      const req = rows[0]
      if (!req) throw new Error(`Verification request ${requestId} not found`)

      // Idempotency guard — already resolved
      if (req.status === 'approved') {
        return {
          skipped: true,
          clerkId: req.clerk_id as string,
          profileId: req.profile_id as string,
          firstName: req.first_name as string | null,
          contactEmail: req.contact_email as string | null,
          requestType: req.request_type as string,
          claimedAbo: req.claimed_abo as string | null,
          currentRole: req.current_role as string,
        }
      }

      if (req.status !== 'pending') {
        throw new Error(
          `Cannot approve request ${requestId} — status is ${req.status}`
        )
      }

      await sql.begin(async (tx) => {
        // 1a. Promote profile to member
        await tx`
          UPDATE profiles
          SET role = 'member', updated_at = NOW()
          WHERE id = ${req.profile_id}
        `

        // 1b. Resolve the verification request
        await tx`
          UPDATE abo_verification_requests
          SET
            status = 'approved',
            resolved_at = NOW(),
            admin_note = ${adminNote ?? null}
          WHERE id = ${requestId}
        `

        // 1c. Upsert tree node (same logic as approve_member_verification RPC)
        await tx`
          INSERT INTO tree_nodes (profile_id, path, depth)
          VALUES (
            ${req.profile_id},
            COALESCE(
              (SELECT path FROM tree_nodes ORDER BY created_at LIMIT 1),
              'root'
            ) || '.' || replace(${req.profile_id}::text, '-', '_'),
            1
          )
          ON CONFLICT (profile_id) DO NOTHING
        `

        // 1d. Audit log
        await tx`
          INSERT INTO role_change_audit
            (profile_id, changed_by, old_role, new_role, note)
          VALUES
            (${req.profile_id}, ${adminClerkId}, 'guest', 'member', ${adminNote ?? null})
        `

        // 1e. Record job in approval_jobs
        await tx`
          INSERT INTO approval_jobs
            (request_id, inngest_event_id, status)
          VALUES
            (${requestId}, ${inngestEventId}, 'processing')
          ON CONFLICT (request_id) DO UPDATE
            SET status = 'processing', updated_at = NOW()
        `
      })

      return {
        skipped: false,
        clerkId: req.clerk_id as string,
        profileId: req.profile_id as string,
        firstName: req.first_name as string | null,
        contactEmail: req.contact_email as string | null,
        requestType: req.request_type as string,
        claimedAbo: req.claimed_abo as string | null,
        currentRole: req.current_role as string,
      }
    })

    // -----------------------------------------------------------------------
    // Step 2: Clerk sync
    // -----------------------------------------------------------------------
    await step.run('clerk-sync', async () => {
      if (!dbResult.clerkId) return
      const clerk = await clerkClient()
      await clerk.users.updateUserMetadata(dbResult.clerkId, {
        publicMetadata: { role: 'member' },
      })

      // Mark job settled in DB
      await sql`
        UPDATE approval_jobs
        SET status = 'clerk_synced', updated_at = NOW()
        WHERE request_id = ${requestId}
      `
    })

    // -----------------------------------------------------------------------
    // Step 3: Notifications + email
    // -----------------------------------------------------------------------
    await step.run('notify', async () => {
      const { createServiceClient } = await import('@/lib/supabase/service')
      const supabase = createServiceClient()

      const notifMessage =
        dbResult.requestType === 'manual'
          ? `Welcome ${dbResult.firstName ?? ''}! Your manual verification has been approved. You are now a Member.`
          : `Welcome ${dbResult.firstName ?? ''}! Your ABO number ${dbResult.claimedAbo} has been verified. You are now a Member.`

      await supabase.from('notifications').insert({
        profile_id: dbResult.profileId,
        type: 'role_request',
        title: 'Verification approved',
        message: notifMessage,
        action_url: '/profile',
      })

      if (dbResult.contactEmail) {
        const { sendNotificationEmail } = await import('@/lib/email/send')
        const { renderEmailTemplate } = await import(
          '@/lib/email/templates/render'
        )
        const { AboVerificationEmail } = await import(
          '@/lib/email/templates/AboVerificationEmail'
        )

        const approvalHtml = await renderEmailTemplate(
          AboVerificationEmail({
            firstName: dbResult.firstName || 'Member',
            claimedAbo: dbResult.claimedAbo,
            status: 'approved',
            adminNote: adminNote,
          })
        )

        await sendNotificationEmail({
          to: dbResult.contactEmail,
          subject: 'ABO Verification Approved ✓',
          html: approvalHtml,
          template: 'abo_verification_result',
          meta: { request_id: requestId, profile_id: dbResult.profileId },
        })

        if (dbResult.currentRole === 'guest') {
          const { WelcomeEmail } = await import(
            '@/lib/email/templates/WelcomeEmail'
          )
          const welcomeHtml = await renderEmailTemplate(
            WelcomeEmail({ firstName: dbResult.firstName || 'Member' })
          )
          await sendNotificationEmail({
            to: dbResult.contactEmail,
            subject: 'Welcome to Team Enjoy VD!',
            html: welcomeHtml,
            template: 'abo_verification_result',
            meta: { request_id: requestId, profile_id: dbResult.profileId },
          })
        }
      }

      // Mark job fully settled
      await sql`
        UPDATE approval_jobs
        SET status = 'done', settled_at = NOW(), updated_at = NOW()
        WHERE request_id = ${requestId}
      `
    })

    return { success: true, requestId }
  }
)
