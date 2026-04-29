import { createRouteMatcher } from '@clerk/nextjs/server'

export const PUBLIC_ROUTE_PATTERNS = [
  '/',
  '/about',
  '/calendar',
  '/trips',
  '/news/(.*)',
  '/guides(.*)',
  '/events/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
  '/api/calendar',
  '/api/calendar/(.*)',
  '/api/events/:id',
  '/api/socials',
  '/api/socials/(.*)',
] as const

export const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTE_PATTERNS])
