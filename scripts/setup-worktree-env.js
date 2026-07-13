#!/usr/bin/env node

/**
 * Copies the main checkout's env files (.env.local and, when present,
 * .env.development.local) into the current git worktree
 * (worktrees under .claude/worktrees/ don't inherit untracked env files,
 * so `npm run dev` fails there with "supabaseUrl is required").
 *
 * Never overwrites a file that already exists in the worktree.
 */

const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const segments = cwd.split(path.sep)
const marker = segments.findIndex(
  (seg, i) => seg === '.claude' && segments[i + 1] === 'worktrees',
)

if (marker === -1) {
  console.error(
    'env:worktree: current directory is not inside a .claude/worktrees worktree.\n' +
      `  cwd: ${cwd}\n` +
      '  In the main checkout, create .env.local from .env.example instead.',
  )
  process.exit(1)
}

const mainRoot = segments.slice(0, marker).join(path.sep)

// .env.local is required; .env.development.local (local Supabase override,
// see docs/DEV_WORKFLOW.md) is copied when the main checkout has one.
const FILES = [
  { name: '.env.local', required: true },
  { name: '.env.development.local', required: false },
]

let copiedDevOverride = false

for (const { name, required } of FILES) {
  const source = path.join(mainRoot, name)
  const dest = path.join(cwd, name)

  if (!fs.existsSync(source)) {
    if (required) {
      console.error(`env:worktree: ${source} not found — the main checkout has no ${name} to copy.`)
      process.exit(1)
    }
    console.warn(
      `env:worktree: main checkout has no ${name} — skipped.\n` +
        '  Without it, dev in this worktree targets the Supabase project from .env.local (PRODUCTION).\n' +
        '  See docs/DEV_WORKFLOW.md "Local Supabase stack" to set it up.',
    )
    continue
  }

  if (fs.existsSync(dest)) {
    console.log(`env:worktree: ${name} already exists in this worktree — leaving it untouched.`)
    console.log('  Delete it first if you want a fresh copy.')
    if (name === '.env.development.local') copiedDevOverride = true
    continue
  }

  fs.copyFileSync(source, dest)
  console.log(`env:worktree: copied ${source} -> ${dest}`)
  if (name === '.env.development.local') copiedDevOverride = true
}

if (copiedDevOverride) {
  console.log(
    '\nenv:worktree: .env.development.local present — `npm run dev` targets the LOCAL Supabase stack.\n' +
      '  (Start it with `supabase start`; see docs/DEV_WORKFLOW.md.)',
  )
} else {
  console.warn(
    '\n⚠  WARNING: .env.local contains PRODUCTION credentials (Supabase service-role key)\n' +
      '   and no .env.development.local override was found: local dev writes hit live data.\n' +
      '   Navigation-only testing — no form submits, no mutations, no destructive experiments.\n' +
      '   Never commit or share these files (.env* is gitignored — keep it that way).',
  )
}
