import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// Playwright's own process (globalSetup + tests) does not inherit Next's env
// loading, so the authenticated project's Clerk/Supabase clients would see no
// keys. Load env files in Next precedence (.env.development.local first, then
// .env.local), never overwriting already-set vars. No-op when files are absent
// (contributor machines / preview-smoke) — keeps other projects unaffected.
for (const f of ['.env.development.local', '.env.local']) {
  const p = path.join(process.cwd(), f)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}

// BASE_URL set (e.g. the preview-smoke workflow pointing at a Vercel preview)
// -> test that deployment and start no local server.
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'

// Vercel "Protection Bypass for Automation": deployment protection (SSO)
// otherwise redirects CI to a vercel.com login page. When the secret is set
// (preview-smoke.yml), globalSetup bootstraps a _vercel_jwt bypass cookie
// into this storage state, which tests then load. Cookie, not a header on
// every request — see vercelBypassSetup() in e2e/global-setup.ts for why.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

// Specs that need Clerk auth + local Supabase, routed to the 'authenticated'
// project and excluded from 'mobile-390'/'desktop' (which run against a live
// Vercel Preview with no Clerk secrets, so clerk.signIn() fails outright).
// Named once so a new authenticated spec can't be added to one list and
// silently omitted from the other two.
const AUTHENTICATED_SPECS = /(admin-auth|admin-mobile-auth|los-submission-auth|profile-bento-auth|payments-on-behalf|payments-guest|member-attend-auth|member-share-register-auth|event-registrations-auth)\.spec\.ts/

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // Only the 'authenticated' project needs this; it no-ops when Clerk env
  // vars aren't configured (see e2e/global-setup.ts), so mobile-390/desktop
  // runs everywhere else (including preview-smoke.yml) are unaffected.
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    ...(bypassSecret && process.env.BASE_URL
      ? { storageState: './e2e/.vercel-bypass-state.json' }
      : {}),
  },
  projects: [
    {
      // 390px is this repo's mobile-first hard constraint.
      // browserName pinned: devices['iPhone 12'] defaults to webkit, but CI
      // (preview-smoke.yml) installs chromium only — keep local & CI identical.
      name: 'mobile-390',
      // profile-bento-auth.spec.ts excluded here too, same reason as
      // admin-auth/los-submission-auth: preview-smoke.yml runs this project
      // against a live Vercel Preview with no Clerk secrets configured, so
      // clerk.signIn() fails outright. Its 390px static-stack coverage runs
      // under 'authenticated' instead, with an explicit viewport override —
      // as does admin-mobile-auth.spec.ts, for the same reason.
      // payments-guest.spec.ts joined that list for exactly this failure: it
      // was collected here on its first CI run and died on "The Clerk Frontend
      // API URL is required to bypass bot protection".
      testIgnore: AUTHENTICATED_SPECS,
      use: {
        ...devices['iPhone 12'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'desktop',
      // profile-bento-auth.spec.ts excluded here too — it's Clerk-authenticated
      // and already covered at 1280px by the 'authenticated' project below;
      // running it a second time on 'desktop' would just duplicate the sign-in.
      // admin-mobile-auth.spec.ts is 390px-only and Clerk-authenticated, so it
      // has no business on a 1280px unauthenticated project either.
      testIgnore: AUTHENTICATED_SPECS,
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      // Authenticated coverage (issue #560) — requires local Supabase +
      // npm run e2e:seed-clerk. Never target a preview/prod-DB deployment.
      name: 'authenticated',
      testMatch: AUTHENTICATED_SPECS,
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
