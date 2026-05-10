import { type NextRequest } from 'next/server'

/**
 * Inngest serve handler.
 *
 * `inngest` is listed in `serverExternalPackages` in next.config.ts so
 * Turbopack treats it as a Node external and skips bundling. However,
 * Turbopack still evaluates top-level imports during the "collect page data"
 * build step — so inngest imports must remain dynamic to prevent
 * `decodeURIComponent` inside the SDK from throwing `URIError: URI malformed`.
 *
 * This applies to both v3 and v4: the crash is a Turbopack bundling artifact,
 * not a version-specific issue. Dynamic imports are the correct workaround.
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

let _handler: Awaited<ReturnType<typeof import('inngest/next').serve>> | null = null

async function getHandler() {
  if (_handler) return _handler
  const { serve } = await import('inngest/next')
  const { inngest } = await import('@/inngest/client')
  const { approveVerification } = await import('@/inngest/functions/approve-verification')
  const { clerkReconciliation } = await import('@/inngest/functions/clerk-reconciliation')
  _handler = serve({
    client: inngest,
    functions: [approveVerification, clerkReconciliation],
  })
  return _handler
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
