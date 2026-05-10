import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { approveVerification } from '@/inngest/functions/approve-verification'
import { clerkReconciliation } from '@/inngest/functions/clerk-reconciliation'

/**
 * Inngest serve handler.
 *
 * `inngest` is listed in `serverExternalPackages` in next.config.ts so
 * Turbopack treats it as a Node external and never bundles it into a server
 * chunk. This prevents `decodeURIComponent` inside the SDK from throwing
 * `URIError: URI malformed` at module evaluation before env vars are injected.
 *
 * `signingKey` and `serveHost` are intentionally omitted from `serve()`:
 * - The SDK reads `INNGEST_SIGNING_KEY` from `process.env` by default.
 * - `serveHost` is not needed in Next.js Route Handlers — `req.url` is
 *   always an absolute URL.
 *
 * This route is intentionally NOT guarded by Clerk auth.
 * Security is enforced by Inngest signing key verification in the SDK.
 * Public route — listed in lib/public-routes.ts.
 */
export const dynamic = 'force-dynamic'

const handler = serve({
  client: inngest,
  functions: [approveVerification, clerkReconciliation],
})

export const { GET, POST, PUT } = handler
