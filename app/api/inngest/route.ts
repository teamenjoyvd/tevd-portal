import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { approveVerification } from '@/inngest/functions/approve-verification'
import { clerkReconciliation } from '@/inngest/functions/clerk-reconciliation'
import { type NextRequest } from 'next/server'

/**
 * Inngest serve handler.
 *
 * v4: configuration is resolved lazily at first use — top-level static imports
 * are safe. The dynamic import workaround from v3 is no longer needed.
 *
 * `inngest` is listed in `serverExternalPackages` in next.config.ts as
 * defensive config; harmless with v4.
 *
 * This route is intentionally NOT guarded by Clerk auth.
 * Security is enforced by Inngest signing key verification in the SDK.
 * Public route — listed in lib/public-routes.ts.
 *
 * Next.js 16 passes ctx.params as Promise<Record<string,string>>.
 * We await before forwarding — this route has no dynamic segments so params
 * is always an empty object.
 */
export const dynamic = 'force-dynamic'

type NextCtx = { params: Promise<Record<string, string>> }

const handler = serve({
  client: inngest,
  functions: [approveVerification, clerkReconciliation],
})

export async function GET(req: NextRequest, ctx: NextCtx) {
  const params = await ctx.params
  return handler.GET(req, { params })
}

export async function POST(req: NextRequest, ctx: NextCtx) {
  const params = await ctx.params
  return handler.POST(req, { params })
}

export async function PUT(req: NextRequest, ctx: NextCtx) {
  const params = await ctx.params
  return handler.PUT(req, { params })
}
