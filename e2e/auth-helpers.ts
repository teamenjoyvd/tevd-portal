import { expect, type Page } from '@playwright/test'
import { clerk } from '@clerk/testing/playwright'

/**
 * Sign in with Clerk, then actually land on a protected route.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT `clerk.signIn()` + `page.goto()`:
 *
 * clerk.signIn() resolves as soon as the BROWSER holds a user object — its
 * final step is `waitForFunction(() => window.Clerk?.user !== null)`
 * (@clerk/testing 2.2.7, dist/playwright/index.mjs). That is an in-memory
 * client signal.
 *
 * Every protected route in this app is authorised on the SERVER instead:
 * proxy.ts runs clerkMiddleware, and when it cannot resolve a userId from the
 * request's session cookie it answers a page navigation with
 * `NextResponse.redirect('/sign-in')` (proxy.ts:14-21).
 *
 * Those two facts become true at different moments. A goto issued on the very
 * next line can therefore be authorised against a cookie the browser has not
 * finished writing, get bounced to /sign-in, and sit there for the rest of the
 * test — which then fails on whatever element it asked for next, naming that
 * element rather than the redirect that actually happened.
 *
 * That is not hypothetical. It is how payments-on-behalf.spec.ts:169 failed on
 * CI run 31532749854: 30s of "element(s) not found" for a button that exists
 * only on /profile, passing on the immediate retry.
 *
 * The fix is to wait on the thing that actually has to become true — the
 * server honouring the session — and the observable proof of that is landing
 * on the requested path instead of /sign-in. Re-navigating is what makes the
 * wait meaningful: the redirect is decided per request, so polling page.url()
 * without re-issuing the navigation would just re-read the same stale bounce.
 *
 * Deliberately NOT a fixed sleep and NOT a bigger timeout on the caller's
 * assertion: both hide the redirect instead of waiting for the session, and
 * leave the failure message pointing at the wrong thing.
 */
export async function gotoProtected(page: Page, path: string, attempts = 4): Promise<void> {
  // Deliberately a retry loop and NOT expect.poll over the navigation. A cold
  // Turbopack route compile can make a perfectly successful goto take a very
  // long time — `GET /profile 200 in 81s` was measured on a dev server for
  // this repo — and a poll deadline would abort that slow-but-fine navigation
  // and report it as a redirect problem. Only the bounce is worth retrying, so
  // only the bounce is retried; a slow success is left alone to finish.
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await page.goto(path)
    if (new URL(page.url()).pathname === path) return

    // Bounced. proxy.ts decides this per request, so re-issuing is the only
    // way to observe the session becoming valid; backing off briefly between
    // attempts is what makes re-issuing worth anything. This is a backoff
    // between observations, not a sleep standing in for one.
    if (attempt < attempts) await page.waitForTimeout(250 * attempt)
  }

  expect(
    new URL(page.url()).pathname,
    `never landed on ${path} after signing in — the request was still being ` +
      `redirected after ${attempts} attempts, so proxy.ts could not resolve a session`,
  ).toBe(path)
}

/**
 * `page.goto('/')` first because clerk.signIn() requires an already-loaded
 * Clerk on a non-protected page (its own docs say so, and it calls
 * clerk.loaded() internally).
 */
export async function signInAndGoto(page: Page, emailAddress: string, path: string): Promise<void> {
  await page.goto('/')
  await clerk.signIn({ page, emailAddress })
  await gotoProtected(page, path)
}
