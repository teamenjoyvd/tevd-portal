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
      HTMLCanvasElement.prototype.getContext = new Proxy(orig, {
        apply(target, thisArg, args: Parameters<typeof orig>) {
          const [type] = args
          if (typeof type === 'string' && type.includes('webgl') === true) return null
          return Reflect.apply(target, thisArg, args)
        },
      })
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

  test('neither tile state overflows the viewport', async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport
    test.skip(viewport == null, 'needs a fixed viewport to assert against')

    const scrollWidth = () =>
      page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0)

    const expectNoOverflow = async (state: string) => {
      const width = await scrollWidth()
      expect(
        width,
        `horizontal overflow on / with the location tile ${state}: ${width}px at ${viewport!.width}px`,
      ).toBeLessThanOrEqual(viewport!.width)
    }

    await page.goto('/')
    // networkidle genuinely never fires on the Vercel preview (persistent background
    // network activity), unlike localhost — confirmed by CI job "390px smoke vs preview"
    // failing here on dev/2608-DEV-698 once this catch was removed. The coordinates
    // assertions below are the real synchronization point; this call is best-effort only.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const tile = page.getByRole('button', { name: CITY }).first()
    // Scoped to the tile, not the page: both the desktop and mobile branches of
    // app/(dashboard)/page.tsx are in the DOM and both now render the coordinates,
    // so a page-level .first() would resolve to the display:none branch. The role
    // locator above already picks the visible one — hidden subtrees are not in the
    // accessibility tree.
    const coords = tile.getByText(COORDS)
    await expect(tile).toBeVisible()

    // The tile ships expanded, and the coordinates line renders in that state only.
    // Waiting on it also lets the size spring settle before each width read.
    await expect(tile).toHaveAttribute('aria-expanded', 'true')
    await expect(coords).toBeVisible()
    await expectNoOverflow('expanded on load')

    await tile.click()
    await expect(tile).toHaveAttribute('aria-expanded', 'false')
    await expect(coords).toBeHidden()
    await expectNoOverflow('collapsed')

    await tile.click()
    await expect(tile).toHaveAttribute('aria-expanded', 'true')
    await expect(coords).toBeVisible()
    await expectNoOverflow('expanded again')
  })
})
