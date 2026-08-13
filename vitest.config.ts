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
    ],
  },
})
