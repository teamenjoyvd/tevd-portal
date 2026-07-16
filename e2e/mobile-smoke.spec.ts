import { test, expect } from '@playwright/test'

import { PUBLIC_SMOKE_ROUTES } from '../lib/public-routes'

/**
 * Navigation-only smoke over the public routes (see lib/public-routes.ts).
 *
 * Since 2026-07-16 previews use the DEV Supabase project (PR #579), so this
 * suite may graduate to real flows; until then it only navigates and reads.
 *
 * Failure policy: fails on HTTP >= 400, horizontal overflow at the
 * project viewport, and uncaught page errors. console.error output is
 * logged for diagnosis but is not fatal (third-party scripts are noisy
 * in prod-like environments).
 */

for (const route of PUBLIC_SMOKE_ROUTES) {
  test(`renders ${route} without overflow or page errors`, async ({ page }, testInfo) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (err) => pageErrors.push(err))
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[console.error] ${route}: ${msg.text()}`)
    })

    const response = await page.goto(route)
    expect(response, `no response for ${route}`).not.toBeNull()
    expect(response!.status(), `HTTP status for ${route}`).toBeLessThan(400)

    // Vercel deployment protection redirects unauthenticated requests to an
    // HTTP-200 login page on vercel.com, which passes every other assertion
    // here. Fail hard if we ever land off the app's origin (see the
    // VERCEL_AUTOMATION_BYPASS_SECRET wiring in playwright.config.ts).
    const expectedOrigin = new URL(process.env.BASE_URL ?? 'http://localhost:3000').origin
    expect(
      new URL(page.url()).origin,
      `landed off the app origin on ${route} — deployment protection (SSO) page instead of the app?`,
    ).toBe(expectedOrigin)

    // Best-effort settle so hydration-induced layout shifts are included;
    // never fails the test on slow background requests.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    await expect(page.locator('body')).toBeVisible()

    const viewport = testInfo.project.use.viewport
    if (viewport != null) {
      const scrollWidth = await page.evaluate(
        () => document.scrollingElement?.scrollWidth ?? 0,
      )
      expect(
        scrollWidth,
        `horizontal overflow on ${route}: content is ${scrollWidth}px wide at a ${viewport.width}px viewport`,
      ).toBeLessThanOrEqual(viewport.width)
    }

    expect(
      pageErrors,
      `uncaught page errors on ${route}: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toHaveLength(0)
  })
}
