import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Default stays node — component suites opt into jsdom with a
    // `// @vitest-environment jsdom` docblock, so one browser-shaped file does
    // not slow every logic test down.
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
      'app/**/*.test.ts',
      'app/**/*.test.tsx',
      'components/**/*.test.tsx',
      'scripts/**/*.test.js',
      // Edge functions are Deno, so most of supabase/functions/ cannot be
      // loaded here. Import-free, Deno-global-free decision modules beside
      // them can be, and are the only part of a function worth unit testing
      // (2608-DEV-764: supabase/functions/sync-google-calendar/reconcile.ts).
      'supabase/functions/**/*.test.ts',
    ],
  },
})
