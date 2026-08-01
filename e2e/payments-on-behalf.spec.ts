import { test, expect, type Page } from '@playwright/test'
import { clerk } from '@clerk/testing/playwright'

/**
 * End-to-end coverage for paying on behalf of others (2607-DEV-676):
 * open the payment drawer, add a second participant through the picker,
 * assert the 50/50 prefill, submit, then withdraw the whole group.
 *
 * Runs under the 'authenticated' project with an explicit 390px viewport
 * override rather than the 'mobile-390' project, for the same reason as
 * profile-bento-auth.spec.ts: mobile-390 runs in preview-smoke.yml against a
 * live Vercel Preview with no Clerk secrets, so clerk.signIn() fails outright
 * there. The picker is a mobile-first surface, so 390px is the viewport that
 * matters.
 *
 * REQUIRES a signed-in member who has at least one other payable beneficiary —
 * a downline, or a co-owner. The DEV fixture seeded for this issue
 * (`clerk_id LIKE 'seed_676_%'`) provides exactly that shape. With only
 * themselves eligible the picker legitimately shows one row and the split path
 * is unreachable, so the suite SKIPS rather than passing vacuously — a green
 * run must mean the flow was actually exercised.
 *
 * Requires local Supabase + a seeded Clerk test-instance member (see
 * scripts/seed-clerk-test-users.js). Never target a preview/prod-DB
 * deployment — same rule as admin-auth.spec.ts.
 */

const MEMBER_EMAIL = process.env.E2E_CLERK_MEMBER_EMAIL ?? 'e2e-member-tevd-portal@example.com'

test.use({ viewport: { width: 390, height: 844 } })

async function signInAndOpenProfile(page: Page) {
  await page.goto('/')
  await clerk.signIn({ page, emailAddress: MEMBER_EMAIL })
  await page.goto('/profile')
  await expect(page.getByRole('button', { name: /submit payment/i }).first()).toBeVisible({ timeout: 30_000 })
}

/** Opens the payment drawer from the Payments bento. */
async function openPaymentDrawer(page: Page) {
  await page.getByRole('button', { name: /\+ submit payment/i }).first().click()
  await expect(page.getByText(/who is this for\?/i)).toBeVisible({ timeout: 15_000 })
}

test.describe('payments on behalf of others @390', () => {
  test('adds a beneficiary, prefills a 50/50 split, submits and withdraws', async ({ page }) => {
    await signInAndOpenProfile(page)
    await openPaymentDrawer(page)

    // The picker is the only source of beneficiaries; it must be warm already.
    await page.getByRole('button', { name: /add person/i }).click()

    const searchBox = page.getByPlaceholder(/search by name or abo/i)
    await expect(searchBox).toBeFocused()

    // Rows are buttons; the payer's own row renders disabled once selected.
    const candidates = page.locator('button:not([disabled])').filter({ hasText: /·/ })
    const count = await candidates.count()
    test.skip(count === 0, 'signed-in member has no other payable beneficiary — seed one before trusting this run')

    await candidates.first().click()

    // Back on the form: Amount is now labelled Total and the breakdown appears.
    await expect(page.getByText(/^total \(/i)).toBeVisible()

    const amountInput = page.locator('input[type="number"]').first()
    await amountInput.fill('200')

    // Equal split prefill: two rows of 100.00 against a 200.00 total.
    const shareInputs = page.locator('input[inputmode="decimal"]')
    await expect(shareInputs).toHaveCount(2)
    await expect(shareInputs.nth(0)).toHaveValue('100.00')
    await expect(shareInputs.nth(1)).toHaveValue('100.00')

    // Typing one row LOCKS it and the still-unlocked row absorbs the
    // difference, so a single edit can never unbalance the form — asserting the
    // warning here would be asserting against the redistribution contract.
    await shareInputs.nth(0).fill('90')
    await expect(shareInputs.nth(1)).toHaveValue('110.00')
    await expect(page.getByText(/must add up to the total/i)).toBeHidden()

    // Locking BOTH rows leaves nothing to absorb the shortfall. That is the
    // only way to reach an unbalanced split, and it must block submission —
    // the same assertion submit_payment_group makes in SQL.
    await shareInputs.nth(1).fill('90')
    await expect(page.getByText(/must add up to the total/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^submit payment$/i })).toBeDisabled()

    // Back to balanced by typing the exact complement.
    await shareInputs.nth(1).fill('110')
    await expect(page.getByText(/must add up to the total/i)).toBeHidden()

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

    // The group card is the confirmation: one card per transfer, withdrawable.
    const withdrawButton = page.getByRole('button', { name: /^withdraw$/i }).first()
    await expect(withdrawButton).toBeVisible({ timeout: 15_000 })

    await withdrawButton.click()
    await expect(page.getByText(/withdraw this payment\?/i)).toBeVisible()
    await page.getByRole('button', { name: /^withdraw$/i }).last().click()

    // Hard delete — the card must be gone, not merely greyed out.
    await expect(page.getByRole('button', { name: /^withdraw$/i })).toHaveCount(0, { timeout: 15_000 })
  })
})
