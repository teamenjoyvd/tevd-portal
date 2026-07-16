import { test, expect } from '@playwright/test'

/**
 * Real guest flow (issue #582): open the library, click a guide card, and
 * land on its detail page. Graduates preview-smoke beyond navigation-only
 * now that previews use the DEV Supabase project (PR #579).
 *
 * Depends on a stable guest-visible guide seeded by scripts/seed-smoke-guide.js
 * (npm run seed:smoke-guide, DEV/local only). When that guide is absent — an
 * unseeded local DB, or DEV freshly re-mirrored from prod — the flow can't
 * run, so it skips with a pointer to the seed command rather than failing on
 * missing fixture data. In CI (seeded DEV preview) it runs for real.
 */

// Kept in sync with scripts/seed-smoke-guide.js (SMOKE_GUIDE_SLUG / title).
const SMOKE_GUIDE_SLUG = 'e2e-smoke-guide'
const SMOKE_GUIDE_TITLE = 'E2E Smoke Guide'

test(`guest opens /library and clicks through to the ${SMOKE_GUIDE_SLUG} guide`, async ({
  page,
}, testInfo) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (err) => pageErrors.push(err))

  await page.goto('/library?type=guides')

  const card = page.locator(`a[href="/library/${SMOKE_GUIDE_SLUG}"]`)
  const seeded = (await card.count()) > 0
  test.skip(
    !seeded,
    `smoke guide "${SMOKE_GUIDE_SLUG}" not present in this DB — run: npm run seed:smoke-guide (DEV/local)`,
  )

  await card.first().click()

  await expect(page).toHaveURL(new RegExp(`/library/${SMOKE_GUIDE_SLUG}$`))
  await expect(page.locator('h1')).toHaveText(SMOKE_GUIDE_TITLE)
  // The detail page renders a back link to the library index.
  await expect(page.locator('a[href="/library"]')).toBeVisible()

  const viewport = testInfo.project.use.viewport
  if (viewport != null) {
    const scrollWidth = await page.evaluate(
      () => document.scrollingElement?.scrollWidth ?? 0,
    )
    expect(
      scrollWidth,
      `horizontal overflow on the guide detail: content is ${scrollWidth}px wide at a ${viewport.width}px viewport`,
    ).toBeLessThanOrEqual(viewport.width)
  }

  expect(
    pageErrors,
    `uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
  ).toHaveLength(0)
})
