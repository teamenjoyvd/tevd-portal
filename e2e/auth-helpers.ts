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

/**
 * Same race as gotoProtected, observed through the API instead of a navigation
 * (2608-DEV-734).
 *
 * gotoProtected proves the server honours the session by landing on a protected
 * PATH — which needs a protected page to navigate to. Two kinds of spec have
 * none:
 *
 * - API-driven specs (los-submission-auth.spec.ts) that only ever call
 *   `page.request.*`. A request issued before the cookie is live comes back 401
 *   from proxy.ts:19, and the assertion then reports "expected 400, got 401" —
 *   naming the status rather than the race that produced it.
 * - Specs whose target page is PUBLIC (`/events/:id/register`,
 *   `/events/:id/join`). clerkMiddleware runs there without protecting, so the
 *   page always renders — just in its anonymous form, with the guest register
 *   form or an invalid-link card instead of the member panel. There is no
 *   redirect to detect.
 *
 * For both, the thing that has to become true is identical: proxy.ts can
 * resolve a userId for this browser context. `/api/profile` is the cheapest
 * honest probe of that. Any non-401 answer settles it — 404 from a session
 * without a profiles row still proves Clerk resolved the user, which is the
 * only question being asked here.
 *
 * `page.request` shares the browser context's cookie jar, so this observes the
 * same session the page will use.
 */
export async function waitForServerSession(page: Page, attempts = 6): Promise<void> {
  let status = 0
  for (let attempt = 1; attempt <= attempts; attempt++) {
    status = (await page.request.get('/api/profile')).status()
    if (status !== 401) return

    // Same reasoning as gotoProtected's backoff: the decision is made per
    // request, so re-issuing is the only way to observe it change.
    if (attempt < attempts) await page.waitForTimeout(250 * attempt)
  }

  expect(
    status,
    `/api/profile was still answering 401 after ${attempts} attempts, so proxy.ts ` +
      `could not resolve a session for this context — the sign-in never reached the server`,
  ).not.toBe(401)
}

/** clerk.signIn() + waitForServerSession, for specs with no protected page to land on. */
export async function signInAndWaitForSession(page: Page, emailAddress: string): Promise<void> {
  await page.goto('/')
  await clerk.signIn({ page, emailAddress })
  await waitForServerSession(page)
}
