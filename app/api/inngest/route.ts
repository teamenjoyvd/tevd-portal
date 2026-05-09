import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { approveVerification } from '@/inngest/functions/approve-verification'
import { clerkReconciliation } from '@/inngest/functions/clerk-reconciliation'

/**
 * Inngest serve handler.
 *
 * This route is intentionally NOT guarded by Clerk auth.
 * Security is enforced by Inngest's signing key verification inside the SDK.
 * INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY must be set in Vercel environment
 * (auto-injected by the Vercel/Inngest integration).
 *
 * Public route — listed in lib/public-routes.ts.
 *
 * force-dynamic prevents Next.js from statically evaluating this route
 * at build time, which causes a URIError when env vars are not available
 * during the build phase.
 */
export const dynamic = 'force-dynamic'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [approveVerification, clerkReconciliation],
})
