import { type NextRequest } from 'next/server'

/**
 * Inngest serve handler.
 *
 * All inngest imports are dynamic (inside each HTTP method) so the inngest
 * package is never evaluated at module load time during Next.js build-time
 * page data collection. The inngest SDK calls decodeURIComponent on
 * INNGEST_SIGNING_KEY at module evaluation — crashing the build worker when
 * the env var is absent or malformed at build time.
 *
 * This route is intentionally NOT guarded by Clerk auth.
 * Security is enforced by Inngest signing key verification in the SDK.
 * Public route — listed in lib/public-routes.ts.
 *
 * Next.js 16 passes ctx.params as Promise<Record<string,string>>.
 * inngest@3 expects ctx.params as Record<string,string> (sync).
 * We await before forwarding — this route has no dynamic segments so params
 * is always an empty object.
 */
export const dynamic = 'force-dynamic'

type NextCtx = { params: Promise<Record<string, string>> }

async function getHandler() {
  const { serve } = await import('inngest/next')
  const { inngest } = await import('@/inngest/client')
  const { approveVerification } = await import('@/inngest/functions/approve-verification')
  const { clerkReconciliation } = await import('@/inngest/functions/clerk-reconciliation')
  return serve({
    client: inngest,
    functions: [approveVerification, clerkReconciliation],
    signingKey: process.env.INNGEST_SIGNING_KEY ?? '',
  })
}

export async function GET(req: NextRequest, ctx: NextCtx) {
  const params = await ctx.params
  return (await getHandler()).GET(req, { params })
}

export async function POST(req: NextRequest, ctx: NextCtx) {
  const params = await ctx.params
  return (await getHandler()).POST(req, { params })
}

export async function PUT(req: NextRequest, ctx: NextCtx) {
  const params = await ctx.params
  return (await getHandler()).PUT(req, { params })
}
