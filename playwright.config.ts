import { defineConfig, devices } from '@playwright/test'

// BASE_URL set (e.g. the preview-smoke workflow pointing at a Vercel preview)
// -> test that deployment and start no local server.
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
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
      use: {
        ...devices['iPhone 12'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'desktop',
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
