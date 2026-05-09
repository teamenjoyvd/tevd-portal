import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { approveVerification } from '@/inngest/functions/approve-verification'
import { clerkReconciliation } from '@/inngest/functions/clerk-reconciliation'

/**
 * Inngest serve handler.
 *
 * This route is intentionally NOT guarded by Clerk auth.
 * Security is enforced by Inngest's signing key verification inside the SDK.
 * INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY must be set in Vercel environment.
 *
 * Public route — listed in lib/public-routes.ts.
 */
const handler = serve({
  client: inngest,
  functions: [approveVerification, clerkReconciliation],
  signingKey: process.env.INNGEST_SIGNING_KEY,
})

export const GET = handler.GET
export const POST = handler.POST
export const PUT = handler.PUT
