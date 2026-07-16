import { request } from '@playwright/test'
import { clerkSetup } from '@clerk/testing/playwright'
import path from 'node:path'

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
export default async function globalSetup() {
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
