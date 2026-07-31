import { test, expect, type Page } from '@playwright/test'
import { clerk } from '@clerk/testing/playwright'
import { BENTO_IDS } from '../app/(dashboard)/profile/components/bento-registry'

/**
 * Regression coverage for the #665 profile-bento shell refactor. dnd-kit
 * drag/reorder, collapse/expand, and `profile.ui_prefs` persistence must
 * survive SortableBento/BentoGrid being rebuilt on the shared BentoCard
 * shell — this spec is the checkpoint for that atomic change (issue
 * "Step 2"), written first so it fails loudly on a half-migrated tree.
 *
 * Runs entirely under the 'authenticated' project (see playwright.config.ts)
 * at 1280px for the dnd-kit drag/collapse/persistence path; the static-stack
 * describe block overrides the viewport to 390px via test.use() instead of
 * relying on the 'mobile-390' project, because that project runs in
 * preview-smoke.yml against a live Vercel Preview with no Clerk secrets
 * configured — clerk.signIn() would fail outright there, the same reason
 * admin-auth.spec.ts/los-submission-auth.spec.ts are excluded from it too.
 *
 * Requires local Supabase + a seeded Clerk test-instance member (see
 * scripts/seed-clerk-test-users.js). Never target a preview/prod-DB
 * deployment — same rule as admin-auth.spec.ts.
 */

const MEMBER_EMAIL = process.env.E2E_CLERK_MEMBER_EMAIL ?? 'e2e-member-tevd-portal@example.com'

// ProfileClient debounces the ui_prefs PATCH after every reorder/collapse/
// reset. This suite used to bridge that with a fixed 800ms sleep, which
// raced the debounce on a loaded CI runner. Every wait now polls observable
// state — see expectPersisted below.

async function signInAndOpenProfile(page: Page) {
  await page.goto('/')
  await clerk.signIn({ page, emailAddress: MEMBER_EMAIL })
  await page.goto('/profile')
  // Waiting on `body` proved nothing: it is visible long before useProfile()
  // resolves, and Playwright's webServer runs `npm run dev`, so /profile is
  // compiled on demand and the first hit is slow. The layout controls are
  // disabled until layoutRestored, so an enabled Reset button is the real
  // signal that the saved layout is in and interaction is safe.
  await expect(page.getByRole('button', { name: 'Reset layout' })).toBeEnabled({ timeout: 60_000 })
}

/**
 * Persistence is debounced (PERSIST_DEBOUNCE_MS in ProfileClient), so the
 * write lands some time after the click. Poll the persisted state instead of
 * sleeping a fixed interval — a fixed sleep races the debounce on a loaded CI
 * runner, which is exactly how this suite failed on #682.
 */
async function expectPersisted(
  page: Page,
  predicate: (prefs: { bento_order?: string[]; bento_collapsed?: Record<string, boolean> }) => boolean,
  message: string,
) {
  await expect
    .poll(async () => predicate(await getPersistedUiPrefs(page)), { message, timeout: 15_000 })
    .toBe(true)
}

async function getPersistedUiPrefs(page: Page) {
  const response = await page.request.get('/api/profile')
  expect(response.status(), 'GET /api/profile').toBe(200)
  const body = await response.json()
  return (body.ui_prefs ?? {}) as { bento_order?: string[]; bento_collapsed?: Record<string, boolean> }
}

test.describe('desktop bento grid — drag, collapse, layout persistence', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'authenticated', 'desktop dnd-kit grid path only runs in the authenticated (1280px) project')
  })

  test('reset layout restores the default order and clears collapse state', async ({ page }) => {
    await signInAndOpenProfile(page)

    await page.getByRole('button', { name: 'Reset layout' }).click()
    // Wait for the reset to actually land, rather than assuming 800ms is
    // enough. Previously this asserted on `bento_order: []` and compared
    // indexOf -1 < -1, which reported a race as a logic failure.
    await expectPersisted(
      page,
      prefs => (prefs.bento_order ?? []).includes(BENTO_IDS.PERSONAL_DETAILS),
      'reset layout should persist bento_order',
    )

    const prefs = await getPersistedUiPrefs(page)
    expect(prefs.bento_collapsed ?? {}).toEqual({})
    // PERSONAL_DETAILS and ABO_INFO are unconditional (rendered for every
    // role) and lead DEFAULT_ORDER — stable anchors regardless of which
    // conditional bentos (Trips, Payments, Admin, ...) this test user sees.
    const order = prefs.bento_order ?? []
    expect(order.indexOf(BENTO_IDS.PERSONAL_DETAILS)).toBeLessThan(order.indexOf(BENTO_IDS.ABO_INFO))
  })

  test('dragging a bento past another persists the new order after reload', async ({ page }) => {
    await signInAndOpenProfile(page)

    await page.getByRole('button', { name: 'Reset layout' }).click()
    await expectPersisted(
      page,
      prefs => (prefs.bento_order ?? []).includes(BENTO_IDS.PERSONAL_DETAILS),
      'reset layout should persist before dragging',
    )
    // Collapse all first: fixed-size bars make the drag geometry
    // deterministic and keep the assertion independent of each bento's
    // (soon to change, per Step 3) internal content layout.
    await page.getByRole('button', { name: 'Collapse all' }).click()
    await expect(page.getByRole('button', { name: 'Expand all' })).toBeVisible()

    const handles = page.locator('[title="Drag to reorder"]')
    await expect(handles.first()).toBeVisible()
    const firstBox = await handles.nth(0).boundingBox()
    const secondBox = await handles.nth(1).boundingBox()
    expect(firstBox, 'first drag handle bounding box').not.toBeNull()
    expect(secondBox, 'second drag handle bounding box').not.toBeNull()

    const beforeOrder = (await getPersistedUiPrefs(page)).bento_order ?? []
    const [firstId, secondId] = beforeOrder

    // Manual pointer sequence (not page.dragTo) — dnd-kit's PointerSensor
    // needs an initial move past its 8px activation distance before the
    // drag registers, then intermediate moves so closestCenter has real
    // in-flight rects to compare against.
    await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + firstBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + firstBox!.height / 2 + 12)
    await page.mouse.move(secondBox!.x + secondBox!.width / 2, secondBox!.y + secondBox!.height / 2 + 4, { steps: 10 })
    await page.mouse.move(secondBox!.x + secondBox!.width / 2, secondBox!.y + secondBox!.height / 2 + 8, { steps: 5 })
    await page.mouse.up()
    await expectPersisted(
      page,
      prefs => {
        const o = prefs.bento_order ?? []
        return o.indexOf(secondId) < o.indexOf(firstId)
      },
      `drag should persist ${secondId} before ${firstId}`,
    )

    await page.reload()
    const afterOrder = (await getPersistedUiPrefs(page)).bento_order ?? []
    expect(afterOrder.indexOf(secondId), `${secondId} should now precede ${firstId}`).toBeLessThan(afterOrder.indexOf(firstId))
  })

  test('collapsing a bento persists after reload', async ({ page }) => {
    await signInAndOpenProfile(page)
    await page.getByRole('button', { name: 'Reset layout' }).click()
    await expectPersisted(
      page,
      prefs => Object.values(prefs.bento_collapsed ?? {}).every(v => !v),
      'reset should clear collapse state',
    )

    const collapseButton = page.getByRole('button', { name: 'Collapse', exact: true }).first()
    await expect(collapseButton).toBeVisible()
    await collapseButton.click()
    await expectPersisted(
      page,
      prefs => Object.values(prefs.bento_collapsed ?? {}).some(Boolean),
      'collapsing one bento should persist',
    )

    const beforeReload = await getPersistedUiPrefs(page)
    const collapsedIds = Object.entries(beforeReload.bento_collapsed ?? {}).filter(([, v]) => v).map(([k]) => k)
    expect(collapsedIds.length, 'exactly one bento collapsed').toBe(1)

    await page.reload()
    const afterReload = await getPersistedUiPrefs(page)
    expect(afterReload.bento_collapsed?.[collapsedIds[0]]).toBe(true)
    // The collapsed bar's expand control replaces the per-item collapse
    // button — confirms the UI, not just the persisted flag, reflects state.
    await expect(page.getByRole('button', { name: 'Expand', exact: true }).first()).toBeVisible()
  })

  test('expand-all toggles every bento back open', async ({ page }) => {
    await signInAndOpenProfile(page)
    await page.getByRole('button', { name: 'Collapse all' }).click()
    await expect(page.getByRole('button', { name: 'Expand all' })).toBeVisible()

    await page.getByRole('button', { name: 'Expand all' }).click()
    await expectPersisted(
      page,
      prefs => Object.values(prefs.bento_collapsed ?? {}).every(v => !v),
      'expand all should clear every collapsed flag',
    )

    const prefs = await getPersistedUiPrefs(page)
    const anyCollapsed = Object.values(prefs.bento_collapsed ?? {}).some(Boolean)
    expect(anyCollapsed, 'no bento should remain collapsed').toBe(false)
    await expect(page.getByRole('button', { name: 'Collapse all' })).toBeVisible()
  })
})

test.describe('mobile static stack (390px)', () => {
  // Runs inside the 'authenticated' project (Clerk sign-in required) with an
  // explicit viewport override, rather than under the 'mobile-390' project —
  // see the file-level comment above for why.
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'authenticated', 'runs under authenticated with a 390px viewport override')
  })

  test('renders the static stack with no drag handle and no horizontal overflow', async ({ page }) => {
    await signInAndOpenProfile(page)

    // disableDrag path (ProfileClient's isDesktop gate false below the
    // md breakpoint) never renders DragHandle — SortableBento only wires
    // it when !disableDrag.
    await expect(page.locator('[title="Drag to reorder"]')).toHaveCount(0)

    // Collapse/expand still work without drag — proves the shared shell
    // isn't drag-coupled.
    const collapseButtons = page.getByRole('button', { name: 'Collapse', exact: true })
    await expect(collapseButtons.first()).toBeVisible()
    await collapseButtons.first().click()
    await expect(page.getByRole('button', { name: 'Expand', exact: true }).first()).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0)
    expect(scrollWidth, 'no horizontal overflow at 390px').toBeLessThanOrEqual(390)
  })
})
