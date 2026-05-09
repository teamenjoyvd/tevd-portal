import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { approveVerification } from '@/inngest/functions/approve-verification'
import { clerkReconciliation } from '@/inngest/functions/clerk-reconciliation'
import { type NextRequest } from 'next/server'

/**
 * Inngest serve handler.
 *
 * This route is intentionally NOT guarded by Clerk auth.
 * Security is enforced by Inngest signing key verification in the SDK.
 * Public route — listed in lib/public-routes.ts.
 *
 * serve() is called lazily (inside each HTTP method) so that the SDK does not
 * execute decodeURIComponent on INNGEST_SIGNING_KEY at module evaluation time,
 * which would throw a URIError during Next.js build-time page data collection
 * when the env var is absent.
 *
 * Next.js 16 passes ctx.params as Promise<Record<string,string>>.
 * inngest@3 expects ctx.params as Record<string,string> (sync).
 * We await before forwarding — this route has no dynamic segments so params
 * is always an empty object.
 */
export const dynamic = 'force-dynamic'

type NextCtx = { params: Promise<Record<string, string>> }

function getHandler() {
  return serve({
    client: inngest,
    functions: [approveVerification, clerkReconciliation],
    signingKey: process.env.INNGEST_SIGNING_KEY ?? '',
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
