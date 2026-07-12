#!/usr/bin/env node

// Next 16.2.10's internal build-time TypeScript check runs in a child process
// that does not inherit a `--max-old-space-size` CLI flag passed to this
// process — only the NODE_OPTIONS env var propagates to it, so the flag must
// be set that way instead of `node --max-old-space-size=... next build`.

const { spawnSync } = require('child_process')

const existingNodeOptions = (process.env.NODE_OPTIONS || '')
  .split(/\s+/)
  .filter((opt) => opt && !opt.startsWith('--max-old-space-size'))

const nodeOptions = [...existingNodeOptions, '--max-old-space-size=4096'].join(' ')

const result = spawnSync(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'build', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  },
)

process.exit(result.status ?? 1)
