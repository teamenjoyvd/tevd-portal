import { test, expect } from '@playwright/test'
import { signInAndGoto } from './auth-helpers'

/**
 * Issuing a free pass at 390px (2611-DEV-775). Same rules as the other
 * authenticated specs: local server, DEV or local Supabase, never production.
 * 390px overflow of the page itself is covered by admin-mobile-auth.spec.ts,
 * which walks ADMIN_NAV.
 */
const ADMIN_EMAIL = process.env.E2E_CLERK_ADMIN_EMAIL ?? 'e2e-admin-tevd-portal@example.com'
const MEMBER_EMAIL = process.env.E2E_CLERK_MEMBER_EMAIL ?? 'e2e-member-tevd-portal@example.com'

test.use({ viewport: { width: 390, height: 844 } })

test('an admin issues a free pass and sees its code', async ({ page }) => {
  await signInAndGoto(page, ADMIN_EMAIL, '/admin/tickets')
  await page.getByRole('button', { name: 'Issue free pass' }).click()

  await page.getByLabel('Product').click()
  await page.getByRole('option', { name: 'Tuesday · Ticket pack' }).click()
  await expect(page.getByLabel('Entries')).toHaveValue('5')
  await page.getByLabel('Holder name').fill('E2E Ticket Holder')
  await page.getByLabel('Holder email').fill('e2e-ticket-holder@example.com')
  await page.getByLabel('Valid through').fill('2099-12-31')
  await page.getByRole('button', { name: 'Issue pass', exact: true }).click()

  await expect(page.getByRole('status').getByText(/^[2-9A-HJ-NP-Z]{8}$/)).toBeVisible({ timeout: 30_000 })
})

test('a member is sent away from the page and refused by the route', async ({ page }) => {
  await signInAndGoto(page, MEMBER_EMAIL, '/profile')
  const res = await page.request.post('/api/admin/tickets/complimentary', { data: {} })
  expect(res.status()).toBe(403)
  await page.goto('/admin/tickets')
  expect(new URL(page.url()).pathname).not.toBe('/admin/tickets')
})
