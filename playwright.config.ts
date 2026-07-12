import { defineConfig, devices } from '@playwright/test'

// BASE_URL set (e.g. the preview-smoke workflow pointing at a Vercel preview)
// -> test that deployment and start no local server.
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'

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
  },
  projects: [
    {
      // 390px is this repo's mobile-first hard constraint.
      // browserName pinned: devices['iPhone 12'] defaults to webkit, but CI
      // (preview-smoke.yml) installs chromium only — keep local & CI identical.
      name: 'mobile-390',
      testIgnore: /admin-auth\.spec\.ts/,
      use: {
        ...devices['iPhone 12'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'desktop',
      testIgnore: /admin-auth\.spec\.ts/,
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      // Authenticated coverage (issue #560) — requires local Supabase +
      // npm run e2e:seed-clerk. Never target a preview/prod-DB deployment.
      name: 'authenticated',
      testMatch: /admin-auth\.spec\.ts/,
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
