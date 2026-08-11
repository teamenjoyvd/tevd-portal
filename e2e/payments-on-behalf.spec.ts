import { test, expect, type Page } from '@playwright/test'
import { signInAndGoto } from './auth-helpers'

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
 * a downline, or a co-owner — and one ACTIVE payable item. Both are seeded by
 * scripts/seed-clerk-test-users.js, so their absence is a broken environment
 * this file FAILS on. It used to skip instead, on `.count()` reads taken before
 * the picker's query had resolved, which made the skip a race rather than a
 * statement about the data: a green run meant nothing in particular.
 *
 * Run `npm run e2e:seed-clerk` first, against local Supabase or the hosted DEV
 * project. Never target a preview/prod-DB deployment — same rule as
 * admin-auth.spec.ts.
 */

const MEMBER_EMAIL = process.env.E2E_CLERK_MEMBER_EMAIL ?? 'e2e-member-tevd-portal@example.com'

test.use({ viewport: { width: 390, height: 844 } })

async function signInAndOpenProfile(page: Page) {
  // signInAndGoto, not signIn + goto: the session has to be live SERVER-side
  // before /profile will render at all, and clerk.signIn() only proves it
  // client-side. See e2e/auth-helpers.ts for the full account.
  await signInAndGoto(page, MEMBER_EMAIL, '/profile')
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

    // Waited for, not counted. `.count()` does not auto-wait, so on a cold
    // picker it read 0 before get_payable_beneficiaries had resolved and the
    // test skipped itself — intermittently, which is worse than never running.
    // The downline fixture is seeded by scripts/seed-clerk-test-users.js, so
    // its absence is a failure, not a reason to stand down.
    await expect(candidates.first()).toBeVisible({ timeout: 15_000 })
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
      // Same reasoning as the picker above: the seed guarantees one ACTIVE EUR
      // payable item, so a placeholder-only <select> is a broken environment to
      // fail on, not a condition to skip past.
      await expect(options.nth(1)).toBeAttached({ timeout: 15_000 })
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

/**
 * The /profile/payments drill-down ledger (2608-DEV-688). L8 and L3 from the
 * issue's verification matrix.
 *
 * Reached by clicking the bento's link rather than by page.goto: the link
 * existing and being a client-side navigation is half of what replaced the old
 * "show more" drawer, and a direct goto would not notice if it broke.
 */
test.describe('profile payments ledger @390', () => {
  test('L8: renders at 390px with no horizontal overflow', async ({ page }) => {
    await signInAndOpenProfile(page)

    // Deliberately NOT guarded by "does this member have payments". The page
    // renders its heading, the three lifetime total cards, the filter row and
    // the empty-state on a ledger with zero rows, and those blocks are the
    // widest thing on it — so the 390px assertion is meaningful either way.
    // An earlier version reached the page only through the bento link and
    // therefore skipped outright on CI's empty fixture: a green tick that had
    // measured nothing, which is the failure mode issue #679 tracks.
    const viewAll = page.getByRole('link', { name: /view all payments/i })
    if (await viewAll.count() > 0) {
      // Prefer the real click when there IS data: the link replacing the old
      // "show more" drawer is part of what this issue changed.
      await viewAll.first().click()
    } else {
      await page.goto('/profile/payments')
    }

    await expect(page).toHaveURL(/\/profile\/payments$/)
    await expect(page.getByRole('heading', { name: /all payments/i })).toBeVisible({ timeout: 15_000 })
    // The totals grid renders on an empty ledger too, so this holds whether or
    // not the member has payments — and it is one of the two widest blocks the
    // scrollWidth assertion below is actually measuring.
    await expect(page.getByTestId('ledger-totals')).toBeVisible()

    // 390 is not the running project's width by coincidence: the module-level
    // test.use() above pins the viewport for every test in this file, so this
    // measurement means the same thing under any project that picks the file up.
    const scrollWidth = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0)
    expect(scrollWidth, 'no horizontal overflow at 390px').toBeLessThanOrEqual(390)
  })

  test('L3: a row someone else paid for me is labelled with the payer', async ({ page }) => {
    await signInAndOpenProfile(page)
    await page.goto('/profile/payments')
    await expect(page.getByRole('heading', { name: /all payments/i })).toBeVisible({ timeout: 15_000 })

    // Scoped to the below-md card list on purpose. The md: <table> renders the
    // same attribution text into the DOM while display:none, so an unscoped
    // getByText would match a hidden node and fail toBeVisible() at 390px.
    const paidBy = page.getByTestId('ledger-cards').getByText(/paid by /i)

    // Unconditional. scripts/seed-clerk-test-users.js seeds a co-owner and one
    // payment group that co-owner paid for this member, so the row is part of
    // the fixture rather than something the environment might happen to have.
    // An earlier version skipped when the ledger was empty, which made a green
    // run mean nothing — the failure mode issue #679 tracks.
    await expect(paidBy.first()).toBeVisible()
  })
})
