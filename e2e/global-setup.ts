import { clerkSetup } from '@clerk/testing/playwright'

/**
 * Only the 'authenticated' project (e2e/admin-auth.spec.ts) needs a Clerk
 * testing token. Skips silently when Clerk env vars aren't configured
 * (preview-smoke.yml, contributor machines without .env.local) so
 * mobile-390/desktop stay unaffected everywhere else. Any other failure
 * (bad key, network, clerkSetup's own production-key guard) is rethrown —
 * that indicates a real misconfiguration, not an absent optional feature.
 */
export default async function globalSetup() {
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
