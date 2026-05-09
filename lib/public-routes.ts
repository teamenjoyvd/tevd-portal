import { createRouteMatcher } from '@clerk/nextjs/server'

/**
 * Intended guest-accessible surface (keep this comment current on any route rename):
 *   /                  homepage
 *   /about             about page
 *   /calendar          public calendar
 *   /trips             trips index
 *   /events/(.*)       event detail
 *   /news/(.*)         announcement detail
 *   /library(.*)       library index + guide detail (was /guides before rename)
 *   /sign-in(.*)       auth
 *   /sign-up(.*)       auth
 *   /api/webhooks/(.*) Clerk + Stripe webhooks
 *   /api/calendar      public calendar API
 *   /api/calendar/(.*) public calendar API
 *   /api/events/:id    public event detail API
 *   /api/socials       public socials API
 *   /api/socials/(.*) public socials API
 *   /api/inngest       Inngest serve handler — public by necessity, signing key auth only
 */
export const PUBLIC_ROUTE_PATTERNS = [
  '/',
  '/about',
  '/calendar',
  '/trips',
  '/news/(.*)',
  '/library(.*)',
  '/events/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
  '/api/calendar',
  '/api/calendar/(.*)',
  '/api/events/:id',
  '/api/socials',
  '/api/socials/(.*)',
  '/api/inngest',
] as const

export const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTE_PATTERNS])
