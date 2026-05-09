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
 *
 * inngest@3 serve() types .GET/.POST/.PUT as (req, ctx) where ctx carries
 * route params. This route has no dynamic segments so params is always {}.
 */
export const dynamic = 'force-dynamic'

type InngestCtx = { params: Record<string, string> }

function getHandler() {
  return serve({
    client: inngest,
    functions: [approveVerification, clerkReconciliation],
  })
}

export async function GET(req: NextRequest, ctx: InngestCtx) {
  return getHandler().GET(req, ctx)
}

export async function POST(req: NextRequest, ctx: InngestCtx) {
  return getHandler().POST(req, ctx)
}

export async function PUT(req: NextRequest, ctx: InngestCtx) {
  return getHandler().PUT(req, ctx)
}
