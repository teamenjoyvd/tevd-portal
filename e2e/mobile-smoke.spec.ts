import { test, expect } from '@playwright/test'

/**
 * Navigation-only smoke over the public routes (see lib/public-routes.ts).
 *
 * PROD-DB FENCE: local dev and Vercel previews point at the PRODUCTION
 * Supabase project until #547 (local Supabase) lands. Tests in this suite
 * must only navigate and read — never submit forms, click mutating
 * controls, or call write APIs.
 *
 * Failure policy: fails on HTTP >= 400, horizontal overflow at the
 * project viewport, and uncaught page errors. console.error output is
 * logged for diagnosis but is not fatal (third-party scripts are noisy
 * in prod-like environments).
 */

const PUBLIC_ROUTES = ['/', '/about', '/calendar', '/trips', '/library', '/sign-in']

for (const route of PUBLIC_ROUTES) {
  test(`renders ${route} without overflow or page errors`, async ({ page }, testInfo) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (err) => pageErrors.push(err))
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[console.error] ${route}: ${msg.text()}`)
    })

    const response = await page.goto(route)
    expect(response, `no response for ${route}`).not.toBeNull()
    expect(response!.status(), `HTTP status for ${route}`).toBeLessThan(400)

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
