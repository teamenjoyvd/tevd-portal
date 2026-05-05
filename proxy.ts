import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isPublicRoute } from '@/lib/public-routes'

const isAdminApiRoute = createRouteMatcher(['/api/admin/(.*)'])
const isAdminPageRoute = createRouteMatcher(['/admin/(.*)'])

export default clerkMiddleware(async (auth, req) => {
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
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
