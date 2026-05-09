import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { approveVerification } from '@/inngest/functions/approve-verification'
import { clerkReconciliation } from '@/inngest/functions/clerk-reconciliation'
import { type NextRequest } from 'next/server'

/**
 * Inngest serve handler.
 *
 * Lazy-initialized inside each HTTP method to avoid Inngest SDK executing
 * decodeURIComponent on INNGEST_SIGNING_KEY at module evaluation time,
 * which crashes Next.js build during static page data collection.
 *
 * This route is intentionally NOT guarded by Clerk auth.
 * Security is enforced by Inngest signing key verification in the SDK.
 * Public route — listed in lib/public-routes.ts.
 */
export const dynamic = 'force-dynamic'

function getHandler() {
  return serve({
    client: inngest,
    functions: [approveVerification, clerkReconciliation],
  })
}

export async function GET(req: NextRequest) {
  return getHandler().GET(req)
}

export async function POST(req: NextRequest) {
  return getHandler().POST(req)
}

export async function PUT(req: NextRequest) {
  return getHandler().PUT(req)
}
