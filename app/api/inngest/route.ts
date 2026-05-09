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
 * Type note: Next.js 16 requires ctx.params to be Promise<{}> (async params).
 * inngest@3 serve() expects ctx.params to be Record<string, string> (sync).
 * Since this route has no dynamic segments, params is always empty.
 * We await params and cast to satisfy both type systems at the call boundary.
 */
export const dynamic = 'force-dynamic'

// Next.js 16 App Router context shape (params is a Promise)
type NextCtx = { params: Promise<Record<string, string>> }

function getHandler() {
  return serve({
    client: inngest,
    functions: [approveVerification, clerkReconciliation],
  })
}

export async function GET(req: NextRequest, ctx: NextCtx) {
  const params = await ctx.params
  return getHandler().GET(req, { params })
}

export async function POST(req: NextRequest, ctx: NextCtx) {
  const params = await ctx.params
  return getHandler().POST(req, { params })
}

export async function PUT(req: NextRequest, ctx: NextCtx) {
  const params = await ctx.params
  return getHandler().PUT(req, { params })
}
