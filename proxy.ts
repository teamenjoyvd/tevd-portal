import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isPublicRoute } from '@/lib/public-routes'

const PREVIEW_TOKEN = 'itypoonpurpoise'
const PREVIEW_COOKIE = 'tevd_preview'
const COMING_SOON_ENABLED = true

const isAdminApiRoute = createRouteMatcher(['/api/admin/(.*)'])
const isAdminPageRoute = createRouteMatcher(['/admin/(.*)'])
const isComingSoonRoute = createRouteMatcher(['/coming-soon'])
const isWebhookRoute = createRouteMatcher(['/api/webhooks/(.*)', '/api/waiting-list'])

function comingSoonGate(req: NextRequest): NextResponse | null {
  if (!COMING_SOON_ENABLED) return null
  if (isComingSoonRoute(req)) return null
  if (isWebhookRoute(req)) return null

  // Grant access via query param — set cookie and redirect to homepage
  const url = req.nextUrl
  if (url.searchParams.get('preview') === PREVIEW_TOKEN) {
    const res = NextResponse.redirect(new URL('/', req.url))
    res.cookies.set(PREVIEW_COOKIE, PREVIEW_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })
    return res
  }

  // Valid cookie — pass through
  if (req.cookies.get(PREVIEW_COOKIE)?.value === PREVIEW_TOKEN) return null

  // No access — redirect to coming soon
  return NextResponse.redirect(new URL('/coming-soon', req.url))
}

export default clerkMiddleware(async (auth, req) => {
  const gate = comingSoonGate(req)
  if (gate) return gate

  if (isPublicRoute(req)) return

  const { userId } = await auth()
  if (!userId) {
    const isApiRequest =
      req.nextUrl.pathname.startsWith('/api/') ||
      isAdminApiRoute(req)
    if (isApiRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  if (isAdminApiRoute(req)) return
  if (isAdminPageRoute(req)) return
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
