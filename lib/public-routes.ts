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
 *   /erc2026           ERC 2026 trip guide (public link, no login required)
 *   /api/webhooks/(.*) Clerk webhooks
 *   /api/calendar      public calendar API
 *   /api/calendar/(.*) public calendar API
 *   /api/events/:id    public event detail API
 *   /api/socials       public socials API
 *   /api/socials/(.*) public socials API
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
  '/erc2026',
  '/api/webhooks/(.*)',
  '/api/calendar',
  '/api/calendar/(.*)',
  '/api/events/:id',
  '/api/socials',
  '/api/socials/(.*)',
] as const

export const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTE_PATTERNS])

/**
 * Static public PAGE routes — consumed by the Playwright smoke suite
 * (e2e/mobile-smoke.spec.ts). Keep in sync with PUBLIC_ROUTE_PATTERNS
 * above: every static page pattern belongs here; dynamic segments and
 * API routes are deliberately excluded (the smoke navigates fixed URLs).
 */
export const PUBLIC_SMOKE_ROUTES = [
  '/',
  '/about',
  '/calendar',
  '/trips',
  '/library',
  '/sign-in',
] as const
