import { request } from '@playwright/test'
import { clerkSetup } from '@clerk/testing/playwright'
import path from 'node:path'
import { isSafeSupabaseTarget, DEV_PROJECT_REF } from '../scripts/lib/safe-supabase-target'

// Written by globalSetup, consumed as storageState in playwright.config.ts.
export const VERCEL_BYPASS_STATE = path.join(__dirname, '.vercel-bypass-state.json')

/**
 * Vercel "Protection Bypass for Automation", cookie flow: one bootstrap
 * request carrying the secret plus x-vercel-set-bypass-cookie makes Vercel
 * set a _vercel_jwt cookie for the deployment; tests then authenticate via
 * that cookie alone. Never send the secret as a header on every page
 * request (extraHTTPHeaders): custom headers force CORS preflights on
 * cross-origin fetches (e.g. clerk.accounts.dev), which break the app.
 */
async function vercelBypassSetup() {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const baseURL = process.env.BASE_URL
  if (!secret || !baseURL) return
  const ctx = await request.newContext()
  const res = await ctx.get(baseURL, {
    headers: {
      'x-vercel-protection-bypass': secret,
      'x-vercel-set-bypass-cookie': 'true',
    },
    maxRedirects: 0,
  })
  const cookies = (await ctx.storageState()).cookies
  if (!cookies.some((c) => c.name === '_vercel_jwt')) {
    throw new Error(
      `Vercel bypass bootstrap got HTTP ${res.status()} from ${baseURL} but no _vercel_jwt cookie — is VERCEL_AUTOMATION_BYPASS_SECRET current?`,
    )
  }
  await ctx.storageState({ path: VERCEL_BYPASS_STATE })
  await ctx.dispose()
}

/**
 * Only the 'authenticated' project (e2e/admin-auth.spec.ts) needs a Clerk
 * testing token. Skips silently when Clerk env vars aren't configured
 * (preview-smoke.yml, contributor machines without .env.local) so
 * mobile-390/desktop stay unaffected everywhere else. Any other failure
 * (bad key, network, clerkSetup's own production-key guard) is rethrown —
 * that indicates a real misconfiguration, not an absent optional feature.
 */
/**
 * Refuse to run while a service-role key points at anything but local or the
 * hosted DEV project (2608-DEV-722).
 *
 * The authenticated specs WRITE rows through the service client, and they read
 * NEXT_PUBLIC_SUPABASE_URL from whatever the shell exports. `.env.local` holds
 * PRODUCTION credentials, so a shell that simply forgot the DEV exports would
 * seed events and registrations into prod. The key's presence is the precise
 * trigger: a run that cannot write cannot cause this.
 *
 * Same guard the seed scripts already use, so there is one definition of
 * "a safe write target" rather than a second copy to drift.
 */
function assertSafeSupabaseTarget() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (isSafeSupabaseTarget(url)) return
  throw new Error(
    `Refusing to run: SUPABASE_SERVICE_ROLE_KEY is set while NEXT_PUBLIC_SUPABASE_URL is "${url}", ` +
      `which is neither a local instance nor the hosted DEV project (${DEV_PROJECT_REF}). ` +
      'The authenticated specs write rows — this would have written them to production. ' +
      'Export the DEV URL and key before running.',
  )
}

// No "is the server up?" preflight here, deliberately: Playwright starts
// config.webServer BEFORE globalSetup, so by the time this runs the server is
// either up or the run has already died on the webServer timeout. Measured
// 2026-08-10 — a run with no server spent 2m06s inside webServer and never
// reached this file. The absent-server case is owned by webServer.timeout in
// playwright.config.ts; the died-mid-run case by e2e/server-watchdog-reporter.ts.

export default async function globalSetup() {
  assertSafeSupabaseTarget()
  await vercelBypassSetup()
  try {
    await clerkSetup()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const notConfigured =
      message.includes('CLERK_PUBLISHABLE_KEY environment variable') ||
      message.includes('CLERK_SECRET_KEY or the CLERK_TESTING_TOKEN environment variable')
    if (!notConfigured) throw err
  }
}
