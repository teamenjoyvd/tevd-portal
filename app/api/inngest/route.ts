import { serve } from '@inngest/next'
import { inngest } from '@/inngest/client'
import { approveVerification } from '@/inngest/functions/approve-verification'
import { clerkReconciliation } from '@/inngest/functions/clerk-reconciliation'

/**
 * Inngest serve handler.
 *
 * This route is intentionally NOT guarded by Clerk auth.
 * Security is enforced by Inngest's signing key verification inside the SDK.
 * INNGEST_SIGNING_KEY must be set in Vercel environment.
 *
 * Public route — must be added to the public route list in proxy.ts.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [approveVerification, clerkReconciliation],
})
