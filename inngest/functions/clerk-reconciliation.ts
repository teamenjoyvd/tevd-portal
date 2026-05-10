import { inngest } from '@/inngest/client'
import sql from '@/lib/db/client'
import { clerkClient } from '@clerk/nextjs/server'

/**
 * Scheduled Inngest function — runs every 15 minutes.
 *
 * Detects profiles where Supabase has role = 'member' but Clerk
 * publicMetadata.role does not match. This is a split-state caused by a
 * Clerk sync failure in the approval flow.
 *
 * Scope: only profiles whose verification request was resolved within the
 * last 1 hour to avoid scanning the full table on every run.
 *
 * On each drift detected:
 *   1. Patches Clerk publicMetadata.role to 'member'.
 *   2. Logs the correction to verification_log (error_message column).
 */
export const clerkReconciliation = inngest.createFunction(
  {
    id: 'clerk-reconciliation',
    retries: 2,
    triggers: [{ cron: '*/15 * * * *' }],
  },
  async ({ step }) => {
    const driftedProfiles = await step.run(
      'find-drifted-profiles',
      async () => {
        const rows = await sql`
          SELECT
            p.id AS profile_id,
            p.clerk_id,
            r.id AS request_id
          FROM profiles p
          JOIN abo_verification_requests r ON r.profile_id = p.id
          WHERE
            p.role = 'member'
            AND r.status = 'approved'
            AND r.resolved_at > NOW() - INTERVAL '1 hour'
        `
        return rows as unknown as Array<{
          profile_id: string
          clerk_id: string
          request_id: string
        }>
      }
    )

    if (driftedProfiles.length === 0) return { patched: 0 }

    const clerk = await clerkClient()
    let patched = 0

    for (const profile of driftedProfiles) {
      await step.run(
        `reconcile-${profile.profile_id}`,
        async () => {
          // Check actual Clerk metadata to detect real drift
          const clerkUser = await clerk.users.getUser(profile.clerk_id)
          const clerkRole = (clerkUser.publicMetadata as { role?: string })?.role

          if (clerkRole === 'member') return // already in sync

          // Patch Clerk
          await clerk.users.updateUserMetadata(profile.clerk_id, {
            publicMetadata: { role: 'member' },
          })

          // Log correction — verification_log uses error_message as the message column
          await sql`
            INSERT INTO verification_log
              (request_id, error_message, error_code)
            VALUES
              (
                ${profile.request_id},
                ${'clerk_reconciliation: patched role from ' + (clerkRole ?? 'unknown') + ' to member'},
                'clerk_drift_corrected'
              )
          `

          patched++
        }
      )
    }

    return { patched }
  }
)
