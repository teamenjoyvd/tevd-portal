import { test, expect, type Page } from '@playwright/test'
import { signInAndWaitForSession } from './auth-helpers'

/**
 * Authenticated coverage of proxy.ts's pass-through path plus the role
 * gates in getCallerContext (lib/supabase/guards.ts) and AdminLayout
 * (app/admin/layout.tsx). Requires local Supabase + two seeded Clerk
 * test-instance users — run `npm run e2e:seed-clerk` first (see
 * scripts/seed-clerk-test-users.js). Never run against a preview/prod-DB
 * target: this suite signs real sessions in against whatever Supabase
 * project NEXT_PUBLIC_SUPABASE_URL points at.
 *
 * Baseline behavior (established by reading the guard code, not assumed):
 * non-admin authenticated users are redirected away from /admin pages and
 * get 403 JSON from /api/admin/* routes; admins get 200 on both.
 */

// Clerk's email validator rejects the .test TLD (RFC 2606) — example.com passes.
const MEMBER_EMAIL = process.env.E2E_CLERK_MEMBER_EMAIL ?? 'e2e-member-tevd-portal@example.com'
const ADMIN_EMAIL = process.env.E2E_CLERK_ADMIN_EMAIL ?? 'e2e-admin-tevd-portal@example.com'

/**
 * Waits for the session rather than for a landing (2608-DEV-734).
 *
 * gotoProtected does not fit this suite: two of its tests assert on
 * `page.request` responses and never navigate, and the other two navigate to
 * /admin/members precisely to observe what happens — one of them EXPECTING to
 * be bounced. A helper that retries until it lands on the path would fight both
 * intentions. What all four need is only that the server can resolve the
 * session before the assertion runs.
 */
async function signInAs(page: Page, emailAddress: string) {
  await signInAndWaitForSession(page, emailAddress)
}

test.describe('member (non-admin) hitting admin surfaces', () => {
  test('GET /admin/members redirects away from /admin', async ({ page }) => {
    await signInAs(page, MEMBER_EMAIL)
    await page.goto('/admin/members')
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test('GET /api/admin/members returns 403 Forbidden', async ({ page }) => {
    await signInAs(page, MEMBER_EMAIL)
    const response = await page.request.get('/api/admin/members')
    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: 'Forbidden' })
  })
})

test.describe('admin hitting admin surfaces', () => {
  test('GET /admin/members renders', async ({ page }) => {
    await signInAs(page, ADMIN_EMAIL)
    const response = await page.goto('/admin/members')
    expect(response, 'no response for /admin/members').not.toBeNull()
    expect(response!.status()).toBeLessThan(400)
    expect(new URL(page.url()).pathname).toBe('/admin/members')
    await expect(page.locator('body')).toBeVisible()
  })

  test('GET /api/admin/members returns 200 with LOS payload', async ({ page }) => {
    await signInAs(page, ADMIN_EMAIL)
    const response = await page.request.get('/api/admin/members')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('los_members')
  })
})
