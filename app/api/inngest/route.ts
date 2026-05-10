import { type NextRequest } from 'next/server'

/**
 * Inngest serve handler.
 *
 * `inngest` is listed in `serverExternalPackages` in next.config.ts so
 * Turbopack treats it as a Node external and never bundles it into a server
 * chunk. Without this, Turbopack evaluates the inngest module graph at build
 * time, causing `decodeURIComponent` inside the SDK to throw
 * `URIError: URI malformed` before any request is handled.
 *
 * `signingKey` and `serveHost` are intentionally omitted from `serve()`:
 * - The SDK reads `INNGEST_SIGNING_KEY` from `process.env` by default.
 *   Passing it explicitly forced eager key processing at module evaluation.
 * - `serveHost` is not needed in Next.js Route Handlers — `req.url` is
 *   always an absolute URL. Passing it caused double URL construction.
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
