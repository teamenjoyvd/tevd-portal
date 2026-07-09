import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { PUBLIC_ROUTE_PATTERNS, isPublicRoute } from '@/lib/public-routes'

describe('PUBLIC_ROUTE_PATTERNS', () => {
  it('equals the documented 16-entry guest surface exactly', () => {
    expect(PUBLIC_ROUTE_PATTERNS).toEqual([
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
    ])
    expect(PUBLIC_ROUTE_PATTERNS).toHaveLength(16)
  })
})

function reqFor(path: string): NextRequest {
  return new NextRequest(new URL(path, 'https://www.teamenjoyvd.com'))
}

describe('isPublicRoute', () => {
  const publicPaths = [
    '/',
    '/about',
    '/calendar',
    '/trips',
    '/news/some-announcement',
    '/library',
    '/library/some-guide',
    '/events/123',
    '/sign-in',
    '/sign-in/factor-one',
    '/sign-up',
    '/sign-up/verify',
    '/erc2026',
    '/api/webhooks/clerk',
    '/api/calendar',
    '/api/calendar/feed',
    '/api/events/123',
    '/api/socials',
    '/api/socials/latest',
  ]

  it.each(publicPaths)('matches %s', (path) => {
    expect(isPublicRoute(reqFor(path))).toBe(true)
  })

  const privatePaths = ['/profile', '/api/profile', '/api/admin/members']

  it.each(privatePaths)('rejects %s', (path) => {
    expect(isPublicRoute(reqFor(path))).toBe(false)
  })
})
