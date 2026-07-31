import { test, expect, type Page } from '@playwright/test'
import { clerk } from '@clerk/testing/playwright'
import { ADMIN_NAV } from '../lib/nav'

/**
 * 390px overflow coverage for the admin section (issue #678).
 *
 * The existing 390px harness (e2e/mobile-smoke.spec.ts) only walks
 * PUBLIC_SMOKE_ROUTES, and every admin route is auth-gated, so the whole
 * admin section shipped without a mobile check — that is how the tab bars,
 * list-card action rows and the trapped tables in this issue got in.
 *
 * Runs under the 'authenticated' project with an explicit 390px viewport
 * override rather than under 'mobile-390', for the same reason
 * profile-bento-auth.spec.ts does: 'mobile-390' also runs in
 * preview-smoke.yml against a live Vercel Preview with no Clerk secrets, so
 * clerk.signIn() would fail outright there.
 *
 * Both locales are exercised. Bulgarian strings are materially longer than
 * English ones and are what the reported screenshots show — commit 282aa93
 * was already a BG-only wrap bug, so an EN-only pass can ship an overflow.
 *
 * Requires local Supabase + `npm run e2e:seed-clerk`. Never target a
 * preview/prod-DB deployment — same rule as admin-auth.spec.ts.
 */

const ADMIN_EMAIL = process.env.E2E_CLERK_ADMIN_EMAIL ?? 'e2e-admin-tevd-portal@example.com'
const VIEWPORT_WIDTH = 390

/**
 * playwright.config.ts:24 feeds the same BASE_URL to every project, so a local
 * run with BASE_URL set would point clerk.signIn() — and the writes behind it —
 * at a preview or production deployment. Authenticated specs are local-only
 * (playwright.config.ts:79-80); fail loudly rather than sign in over there.
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const IS_LOCAL_TARGET = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(BASE_URL)

/**
 * Which ADMIN_NAV routes render a tab bar (app/admin/components/AdminTabs.tsx
 * consumers + SettingsTabs). Encoded explicitly so a route that silently loses
 * its tabs — or redirects away before rendering — fails instead of turning the
 * per-tab sweep into a no-op.
 */
const TABBED_ROUTES = new Set([
  '/admin/approval-hub',
  '/admin/content',
  '/admin/members',
  '/admin/settings',
])

// Duplicated from admin-auth.spec.ts:22 rather than exported from it — that
// spec is passing in CI and a shared-helper refactor would put it at risk for
// no benefit here.
async function signInAs(page: Page, emailAddress: string) {
  await page.goto('/')
  await clerk.signIn({ page, emailAddress })
}

/**
 * app/globals.css sets `html { overflow-x: hidden }`, which hides overflow
 * visually but does NOT change scrollWidth — the measurement below still
 * reports the true content width. Verified by injecting a 3000px child and
 * watching scrollingElement.scrollWidth move from 1265 to 3000.
 */
async function expectNoHorizontalOverflow(page: Page, label: string) {
  const scrollWidth = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0)
  expect(
    scrollWidth,
    `horizontal overflow on ${label}: content is ${scrollWidth}px wide at a ${VIEWPORT_WIDTH}px viewport`,
  ).toBeLessThanOrEqual(VIEWPORT_WIDTH)
}

/**
 * Walks the route's own tab bar instead of hard-coding ?tab= values, so the
 * assertion keeps covering tabs that are added or renamed later. Each tab is
 * checked after activation because a tab's panel is only mounted when
 * selected (SettingsTabs renders `tab === t.value ? children : null`).
 */
async function checkRouteAndItsTabs(page: Page, route: string, locale: string) {
  await page.goto(route)
  // Exactly one main landmark: nesting a second one is invalid HTML (the bug
  // fixed on /admin/settings in 045b4e3), and a redirect away from the route
  // would otherwise still satisfy a `.first()` visibility wait.
  const mains = page.getByRole('main')
  await expect(mains).toHaveCount(1, { timeout: 60_000 })
  await expect(mains).toBeVisible()
  expect(new URL(page.url()).pathname, `redirected away from ${route}`).toBe(route)
  await expectNoHorizontalOverflow(page, `${route} [${locale}]`)

  const tabs = page.getByRole('tab')
  // Fail closed: on a tabbed route an empty tab list means the bar never
  // rendered, which would silently skip every per-tab measurement below.
  if (TABBED_ROUTES.has(route)) {
    await expect(tabs.first(), `no tab bar rendered on ${route}`).toBeVisible({ timeout: 15_000 })
  } else {
    await expect(tabs, `unexpected tab bar on ${route} — add it to TABBED_ROUTES`).toHaveCount(0)
  }
  const count = await tabs.count()
  for (let i = 0; i < count; i++) {
    const tab = tabs.nth(i)
    const name = (await tab.textContent())?.trim() ?? `tab ${i}`
    await tab.click()
    // The panel swap is a client re-render, not a navigation — wait for the
    // tab to actually report selected before measuring.
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 })
    await expectNoHorizontalOverflow(page, `${route} > "${name}" [${locale}]`)
  }
}

test.describe('admin section at 390px', () => {
  test.use({ viewport: { width: VIEWPORT_WIDTH, height: 844 } })

  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'authenticated',
      'runs under the authenticated project with a 390px viewport override',
    )
    if (!IS_LOCAL_TARGET) {
      throw new Error(
        `admin-mobile-auth is local-only: BASE_URL is "${BASE_URL}". Signing in here ` +
        `would target a deployed environment's Clerk + Supabase. Unset BASE_URL and run ` +
        `against a local server with local Supabase + npm run e2e:seed-clerk.`,
      )
    }
  })

  for (const locale of ['en', 'bg'] as const) {
    test(`no horizontal overflow on any admin route (${locale})`, async ({ page, context }) => {
      // Locale is a cookie, not a route segment or query param — see
      // COOKIE_KEY in lib/context/LangProvider.tsx. Precedent:
      // e2e/guest-invite.spec.ts:192.
      await context.addCookies([
        { name: 'tevd_lang', value: locale, url: BASE_URL },
      ])

      await signInAs(page, ADMIN_EMAIL)

      for (const item of ADMIN_NAV) {
        await checkRouteAndItsTabs(page, item.href, locale)
      }
    })
  }
})
