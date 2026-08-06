import { test, expect } from '@playwright/test'

/**
 * Regression guard for the home page crashing on WebGL-less browsers.
 *
 * The Location tile used to construct `new mapboxgl.Map()` inside a useEffect
 * with no try/catch. Where no WebGL context is available — privacy browsers
 * with fingerprinting protection, GPU blocklists, low-power mobile contexts —
 * Mapbox threw synchronously from the constructor.
 *
 * Two different failure shapes, both covered below:
 *   - cold load: the throw happened in the CDN script's onload handler, so it
 *     escaped uncaught and the tile silently stayed blank forever;
 *   - re-mount (soft nav back to /): `window.mapboxgl` was already set, so the
 *     effect called initMap() synchronously, React unwound the throw to
 *     app/(dashboard)/error.tsx, and one decorative tile blanked the whole
 *     page. Verified against production 2026-08-06 — this is the path the bug
 *     was reported on, and a cold load alone does NOT reproduce it.
 *
 * Playwright can't toggle GPU support per test, so we make WebGL context
 * acquisition fail before any app code runs. Any future dependency that needs
 * a GPU on this route fails this spec instead of production.
 *
 * Collected by the mobile-390 and desktop projects (both use testIgnore, and
 * this file isn't in the authenticated project's testMatch).
 */

const CITY = 'Sofia, Bulgaria'
const COORDS = '42.6977° N, 23.3219° E'

test.describe('home page without WebGL', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (typeof type === 'string' && type.includes('webgl')) return null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (orig as any).call(this, type, ...rest)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any
    })
  })

  test('cold load renders the location tile, not the error boundary', async ({ page }) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (err) => pageErrors.push(err))

    const response = await page.goto('/')
    expect(response, 'no response for /').not.toBeNull()
    expect(response!.status(), 'HTTP status for /').toBeLessThan(400)

    // Same guard as mobile-smoke: Vercel deployment protection serves an
    // HTTP-200 login page on vercel.com that would pass every other assertion.
    const expectedOrigin = new URL(process.env.BASE_URL ?? 'http://localhost:3000').origin
    expect(
      new URL(page.url()).origin,
      'landed off the app origin — deployment protection (SSO) page instead of the app?',
    ).toBe(expectedOrigin)

    await expect(page.getByText('Something went wrong')).toHaveCount(0)
    // role=button + aria-label — deliberately not getByText, which also matches
    // the AboutTile paragraph mentioning Sofia, Bulgaria.
    await expect(page.getByRole('button', { name: CITY }).first()).toBeVisible()

    expect(
      pageErrors,
      `uncaught page errors on /: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toHaveLength(0)
  })

  test('soft-navigating back to / does not hit the error boundary', async ({ page }) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (err) => pageErrors.push(err))

    await page.goto('/')
    await expect(page.getByRole('button', { name: CITY }).first()).toBeVisible()

    // Client-side round trip. Both links are next/link and exist at every
    // viewport (the header nav itself is behind a hamburger at 390px).
    await page.getByRole('link', { name: 'About us →' }).first().click()
    await expect(page).toHaveURL(/\/about$/)

    await page.locator('header a[href="/"]').first().click()
    await expect(page).toHaveURL(/\/$/)

    await expect(page.getByText('Something went wrong')).toHaveCount(0)
    await expect(page.getByRole('button', { name: CITY }).first()).toBeVisible()

    expect(
      pageErrors,
      `uncaught page errors on the / -> /about -> / round trip: ${pageErrors
        .map((e) => e.message)
        .join('; ')}`,
    ).toHaveLength(0)
  })

  test('expanding the tile does not overflow the viewport', async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport
    test.skip(viewport == null, 'needs a fixed viewport to assert against')

    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const widthBefore = await page.evaluate(
      () => document.scrollingElement?.scrollWidth ?? 0,
    )
    expect(
      widthBefore,
      `horizontal overflow on / before expanding: ${widthBefore}px at ${viewport!.width}px`,
    ).toBeLessThanOrEqual(viewport!.width)

    const tile = page.getByRole('button', { name: CITY }).first()
    await expect(tile).toBeVisible()
    await tile.click()
    // The coordinates line only renders in the expanded state.
    await expect(page.getByText(COORDS).first()).toBeVisible()

    const widthAfter = await page.evaluate(
      () => document.scrollingElement?.scrollWidth ?? 0,
    )
    expect(
      widthAfter,
      `horizontal overflow on / after expanding: ${widthAfter}px at ${viewport!.width}px`,
    ).toBeLessThanOrEqual(viewport!.width)
  })
})
