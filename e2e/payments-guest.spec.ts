import { test, expect, type Page } from '@playwright/test'
import { signInAndGoto } from './auth-helpers'

/**
 * End-to-end coverage for paying on behalf of an ad-hoc guest (2607-DEV-677):
 * open the payment drawer, add a person who has no account at all through the
 * picker's inline form, assert the 50/50 prefill, submit, withdraw the group —
 * then reopen the picker and assert the guest is REMEMBERED, which is the
 * property that makes a second payment for the same friend re-type nothing.
 *
 * Runs under the 'authenticated' project with an explicit 390px viewport
 * override rather than the 'mobile-390' project, for the same reason as
 * payments-on-behalf.spec.ts: mobile-390 runs in preview-smoke.yml against a
 * live Vercel Preview with no Clerk secrets, so clerk.signIn() fails there.
 *
 * Unlike payments-on-behalf.spec.ts this needs NO seeded beneficiary — a guest
 * is typed, not looked up — so the only environmental skip left is the generic
 * context's need for an active payable item.
 *
 * Requires local Supabase + a seeded Clerk test-instance member (see
 * scripts/seed-clerk-test-users.js). Never target a preview/prod-DB
 * deployment — same rule as admin-auth.spec.ts.
 */

const MEMBER_EMAIL = process.env.E2E_CLERK_MEMBER_EMAIL ?? 'e2e-member-tevd-portal@example.com'

// Stable on purpose: payment_guests is uniquely indexed on
// (owner, case-folded name, case-folded email), so every re-run reuses the one
// row instead of accumulating a new Nadia per CI run.
const GUEST_NAME  = 'E2E Guest Nadia'
const GUEST_EMAIL = 'e2e-guest-nadia@example.com'

test.use({ viewport: { width: 390, height: 844 } })

async function signInAndOpenProfile(page: Page) {
  // Same server-vs-client session race as payments-on-behalf.spec.ts — this
  // helper was byte-identical to that one and carried the identical bug.
  // See e2e/auth-helpers.ts.
  await signInAndGoto(page, MEMBER_EMAIL, '/profile')
  await expect(page.getByRole('button', { name: /submit payment/i }).first()).toBeVisible({ timeout: 30_000 })
}

async function openPaymentDrawer(page: Page) {
  await page.getByRole('button', { name: /\+ submit payment/i }).first().click()
  await expect(page.getByText(/who is this for\?/i)).toBeVisible({ timeout: 15_000 })
}

test.describe('paying for an ad-hoc guest @390', () => {
  test('adds a guest with no account, submits, withdraws, and is offered them again', async ({ page }) => {
    await signInAndOpenProfile(page)
    await openPaymentDrawer(page)

    await page.getByRole('button', { name: /add person/i }).click()

    // The way out for someone who is in no list at all.
    await page.getByRole('button', { name: /add a guest/i }).click()

    const nameField = page.getByPlaceholder(/^name$/i)
    await expect(nameField).toBeFocused()

    // A blank name is refused rather than silently creating a nameless guest.
    await page.getByRole('button', { name: /^add$/i }).click()
    await expect(page.getByText(/a name is required/i)).toBeVisible()

    await nameField.fill(GUEST_NAME)
    await page.getByPlaceholder(/email/i).fill(GUEST_EMAIL)
    await page.getByRole('button', { name: /^add$/i }).click()

    // Back on the form: Amount is now labelled Total and the breakdown appears.
    await expect(page.getByText(/^total \(/i)).toBeVisible()

    // The guest is marked as such wherever they appear, because their share
    // will NOT move the payer's own balance.
    await expect(page.getByText(GUEST_NAME).first()).toBeVisible()
    await expect(page.getByText(/not counted towards your own balance/i)).toBeVisible()

    const amountInput = page.locator('input[type="number"]').first()
    await amountInput.fill('200')

    const shareInputs = page.locator('input[inputmode="decimal"]')
    await expect(shareInputs).toHaveCount(2)
    await expect(shareInputs.nth(0)).toHaveValue('100.00')
    await expect(shareInputs.nth(1)).toHaveValue('100.00')

    const today = new Date().toISOString().slice(0, 10)
    await page.locator('input[type="date"]').fill(today)

    // The generic context needs an item before it can submit.
    const itemSelect = page.locator('select')
    if (await itemSelect.count() > 0) {
      const options = itemSelect.locator('option')
      test.skip(await options.count() < 2, 'no active payable item on this environment')
      await itemSelect.selectOption({ index: 1 })
      await amountInput.fill('200')
    }

    await page.getByRole('button', { name: /^submit payment$/i }).click()

    const withdrawButton = page.getByRole('button', { name: /^withdraw$/i }).first()
    await expect(withdrawButton).toBeVisible({ timeout: 15_000 })

    await withdrawButton.click()
    await expect(page.getByText(/withdraw this payment\?/i)).toBeVisible()
    await page.getByRole('button', { name: /^withdraw$/i }).last().click()
    await expect(page.getByRole('button', { name: /^withdraw$/i })).toHaveCount(0, { timeout: 15_000 })

    // THE MEMORY REQUIREMENT. The payments are gone; the guest is not.
    // withdraw_payment_group deletes payments rows only, so the next payment for
    // the same friend is one tap and no typing.
    await openPaymentDrawer(page)
    await page.getByRole('button', { name: /add person/i }).click()
    await page.getByPlaceholder(/search by name or abo/i).fill(GUEST_NAME)

    const remembered = page.getByRole('button').filter({ hasText: GUEST_NAME })
    await expect(remembered.first()).toBeVisible({ timeout: 15_000 })
    // Listed under the ad-hoc section, not among the ABO-less approved members
    // that #676's `relation: 'guest'` already meant.
    //
    // Matched EXACTLY, and scoped to the section header. The picker prints the
    // relation label a second time inside each row's subtitle
    // ("<email> · Guests (no account)"), so the loose regex this started as
    // resolved to two elements and tripped strict mode on the spec's first real
    // run — while the assertion above it, the actual memory requirement, passed.
    await expect(page.getByText('Guests (no account)', { exact: true })).toBeVisible()
  })
})
