#!/usr/bin/env node

/**
 * Validates that every variable listed in .env.example is available,
 * reading env files directly (plain `node` does not auto-load env files —
 * the PR #544 version checked process.env only and always failed).
 *
 * Resolution order lives in ONE place — scripts/lib/env-files.js — and is
 * Next.js's own: process.env, then .env.$(NODE_ENV).local, then .env.local, then
 * .env.$(NODE_ENV), then .env. The FIRST source that DEFINES a key wins even if
 * its value is empty; an empty winner is reported missing. Prints missing names
 * only, never values.
 *
 * Vars listed below a `# --- optional ---` line in .env.example only warn.
 *
 * TWO resolutions, deliberately (2608-DEV-730). This script used to model one —
 * the dev/seed path — and report it as "the" Supabase target. But NODE_ENV
 * selects which .env.$(NODE_ENV).local file exists in the chain, so a single
 * working tree resolves differently depending on the command:
 *
 *   dev/seed path    `next dev`, seed-*.js, Playwright  -> .env.development.local wins
 *   production mode  `next build`, `next start`         -> .env.development.local is
 *                                                          NOT read; .env.local wins
 *
 * With the layout this repo recommends (DEV in .env.development.local, PROD in
 * .env.local) those two answers are DIFFERENT PROJECTS, and the old single line
 * printed the reassuring one. That is the 2026-08-09 incident class exactly: a
 * preflight that says safe when it isn't. Both are printed now, and an unsafe
 * production-mode target warns even when the dev path is clean.
 *
 * Missing/empty required vars are still judged on the dev/seed path alone —
 * that is the path docs/ai/BUILD.md gates, and it is the one a developer running
 * this command is about to use.
 *
 * NEXT_PUBLIC_SUPABASE_URL is classified LOCAL / DEV / PROD / UNKNOWN by
 * scripts/lib/safe-supabase-target.js, so a stray prod URL gets a loud
 * warning (#563).
 */

const fs = require('fs')
const path = require('path')
const { parseEnvLine, makeEnvResolver } = require('./lib/env-files')
const {
  DEV_PROJECT_REF,
  PROD_PROJECT_REF,
  classifySupabaseTarget,
} = require('./lib/safe-supabase-target')

const root = process.cwd()

const OPTIONAL_DIVIDER = /^\s*#\s*-+\s*optional\s*-+/i

/**
 * .env.example is a manifest, not a source of values: only the names and which
 * side of the `# --- optional ---` divider they fall on matter.
 */
function parseExampleFile(filePath) {
  const vars = {}
  const content = fs.readFileSync(filePath, 'utf8')
  let optionalSection = false
  for (const line of content.split(/\r?\n/)) {
    if (OPTIONAL_DIVIDER.test(line)) {
      optionalSection = true
      continue
    }
    const parsed = parseEnvLine(line)
    if (parsed === null) continue
    vars[parsed.name] = { optional: optionalSection }
  }
  return vars
}

const examplePath = path.join(root, '.env.example')
if (!fs.existsSync(examplePath)) {
  console.error(`check:env: ${examplePath} not found — run from the project root.`)
  process.exit(1)
}
const example = parseExampleFile(examplePath)
const required = Object.keys(example).filter((name) => !example[name].optional)
const optional = Object.keys(example).filter((name) => example[name].optional)

if (fs.existsSync(path.join(root, '.env.local')) === false) {
  console.warn(
    'check:env: .env.local not found — resolving from process.env and any other .env* files.\n' +
      '  Fresh clone: cp .env.example .env.local and fill in values.\n' +
      '  Git worktree: npm run env:worktree',
  )
}

// Both resolvers read process.env FIRST, because that is what @next/env and
// playwright.config.ts do: a file value is taken only when the key is absent
// from the initial process.env snapshot. Resolving files first once made an
// exported override invisible — with the DEV project exported, this printed
// "LOCAL stack (127.0.0.1)" from a stale .env.development.local while the dev
// server and Playwright were correctly on DEV.
//
// Neither resolver mutates process.env, so modelling production mode here does
// not change how this process itself resolves anything.
const devSeed = makeEnvResolver(root, 'development')
const productionMode = makeEnvResolver(root, 'production')

function isMissing(name) {
  const value = devSeed.resolve(name)
  return value === undefined || value === ''
}

const missingRequired = required.filter(isMissing)
const missingOptional = optional.filter(isMissing)

if (missingOptional.length > 0) {
  console.warn('check:env: optional variables not set (app falls back to defaults):')
  for (const name of missingOptional) console.warn(`  - ${name}`)
}

if (missingRequired.length > 0) {
  console.error('check:env: missing required environment variables:')
  for (const name of missingRequired) console.error(`  - ${name}`)
  process.exit(1)
}

console.log(`check:env: all ${required.length} required variables are set.`)

const SUPABASE_URL_VAR = 'NEXT_PUBLIC_SUPABASE_URL'

const devUrl = devSeed.resolve(SUPABASE_URL_VAR)
const prodUrl = productionMode.resolve(SUPABASE_URL_VAR)
const devTarget = classifySupabaseTarget(devUrl)
const prodTarget = classifySupabaseTarget(prodUrl)

function describeTarget(target) {
  if (target === 'LOCAL') return 'LOCAL stack (127.0.0.1)'
  if (target === 'DEV') return `DEV project (${DEV_PROJECT_REF}) — safe for local writes`
  if (target === 'PROD') return `PROD project (${PROD_PROJECT_REF}) — LIVE MEMBER DATA`
  if (target === 'UNSET') return `${SUPABASE_URL_VAR} not set on this path`
  return 'UNRECOGNISED host — treated as unsafe'
}

// Anything that is not the local stack or the dev project. UNSET counts: on the
// production-mode path it means the app would start with no Supabase URL at all.
function isUnsafeTarget(target) {
  return target !== 'LOCAL' && target !== 'DEV'
}

console.log(`check:env: Supabase target — dev/seed path (next dev, seed-*.js, Playwright): ${describeTarget(devTarget)}.`)
console.log(`check:env: Supabase target — production mode (next build, next start): ${describeTarget(prodTarget)}.`)

// Sentence one is quoted verbatim by docs/ai/BUILD.md as the stop signal — keep
// the wording if you touch this.
if (isUnsafeTarget(devTarget)) {
  console.warn(
    'check:env: WARNING — Supabase target is NOT the local stack or the dev project.\n' +
      `  ${SUPABASE_URL_VAR}: ${devUrl}\n` +
      '  Writes from here hit real, non-local data. Point .env.development.local at the\n' +
      `  DEV project (${DEV_PROJECT_REF}) unless this is deliberate.`,
  )
}

// Separate warning, not a duplicate: this one fires on a box whose dev path is
// perfectly safe. `.env.development.local` is invisible to NODE_ENV=production,
// so `next build` / `next start` / `npm run start` fall through to `.env.local`.
if (isUnsafeTarget(prodTarget) && prodTarget !== devTarget) {
  console.warn(
    'check:env: WARNING — production-mode commands resolve a DIFFERENT Supabase target.\n' +
      `  next build / next start would use: ${describeTarget(prodTarget)}\n` +
      '  Next.js loads .env.production.local (absent here), never .env.development.local, so\n' +
      '  those commands fall through to .env.local. Running a production build locally is\n' +
      '  therefore NOT covered by the dev/seed line above. Add a .env.production.local\n' +
      '  pointing at DEV if you need to run one.',
  )
}
