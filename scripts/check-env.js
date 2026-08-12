#!/usr/bin/env node

/**
 * Validates that every variable listed in .env.example is available,
 * reading env files directly (plain `node` does not auto-load env files —
 * the PR #544 version checked process.env only and always failed).
 *
 * Sources, in order: process.env (CI / an exported shell override), then
 * .env.development.local, then .env.local — process.env outranks both because
 * that is what @next/env and playwright.config.ts do at runtime, and the file
 * pair keeps Next.js's relative order. Empty values count as missing. Prints
 * missing names only, never values.
 *
 * Resolution contract: the FIRST source that DEFINES the key wins, even if its
 * value is empty; only a wholly undefined key falls through to the next source.
 * This mirrors @next/env and scripts/*'s loadEnvFile, both of which assign only
 * when the key is `=== undefined`. An empty winner is then reported missing.
 *
 * Vars listed below a `# --- optional ---` line in .env.example only warn.
 *
 * Also classifies NEXT_PUBLIC_SUPABASE_URL as LOCAL / DEV / anything else
 * (incl. PROD) so a stray prod URL in local dev gets a loud warning (#563).
 */

const fs = require('fs')
const path = require('path')

const root = process.cwd()

const OPTIONAL_DIVIDER = /^\s*#\s*-+\s*optional\s*-+/i

function parseEnvFile(filePath) {
  const vars = {}
  const content = fs.readFileSync(filePath, 'utf8')
  let optionalSection = false
  for (const line of content.split(/\r?\n/)) {
    if (OPTIONAL_DIVIDER.test(line)) {
      optionalSection = true
      continue
    }
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match === null) continue
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    vars[match[1]] = { value, optional: optionalSection }
  }
  return vars
}

const examplePath = path.join(root, '.env.example')
if (!fs.existsSync(examplePath)) {
  console.error(`check:env: ${examplePath} not found — run from the project root.`)
  process.exit(1)
}
const example = parseEnvFile(examplePath)
const required = Object.keys(example).filter((name) => !example[name].optional)
const optional = Object.keys(example).filter((name) => example[name].optional)

const localPath = path.join(root, '.env.local')
let localVars = {}
if (fs.existsSync(localPath)) {
  localVars = parseEnvFile(localPath)
} else {
  console.warn(
    'check:env: .env.local not found — checking process.env only.\n' +
      '  Fresh clone: cp .env.example .env.local and fill in values.\n' +
      '  Git worktree: npm run env:worktree',
  )
}

const devLocalPath = path.join(root, '.env.development.local')
const devLocalVars = fs.existsSync(devLocalPath) ? parseEnvFile(devLocalPath) : {}

function resolveValue(name) {
  // process.env FIRST — this MUST match how the app and the tests resolve env,
  // or the script certifies a target nobody is actually using. @next/env only
  // takes a file value when the key is absent from the initial process.env
  // snapshot, and playwright.config.ts does the same ("if (process.env[m[1]]
  // === undefined)"). Resolving files first made an exported override
  // invisible: with the DEV project exported, this printed "LOCAL stack
  // (127.0.0.1)" from a stale .env.development.local while the dev server and
  // Playwright were correctly on DEV. Empty counts as unset at every level.
  // DEFINED wins at each level, even when the value is empty — do not "skip
  // the empty one and try the next source". Both @next/env and the seed
  // scripts' loadEnvFile assign only when the key is `=== undefined`, so an
  // exported KEY= (empty) shadows every file and the app really does receive
  // ''. Falling through to the next source here would let check:env certify a
  // value nobody will get, which is the one thing this script exists to
  // prevent. An empty result reaches isMissing() and is reported missing.
  const exported = process.env[name]
  if (exported !== undefined) return exported
  if (devLocalVars[name] !== undefined) return devLocalVars[name].value
  if (localVars[name] !== undefined) return localVars[name].value
  return undefined
}

function isMissing(name) {
  const value = resolveValue(name)
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

const DEV_PROJECT_REF = 'iymwxdewcpvpjgzewtzk'
const PROD_PROJECT_REF = 'ynykjpnetfwqzdnsgkkg'

function classifySupabaseTarget(url) {
  if (!url) return 'UNSET'
  if (url.includes('127.0.0.1') || url.includes('localhost')) return 'LOCAL'
  if (url.includes(DEV_PROJECT_REF)) return 'DEV'
  if (url.includes(PROD_PROJECT_REF)) return 'PROD'
  return 'UNKNOWN'
}

const supabaseUrl = resolveValue('NEXT_PUBLIC_SUPABASE_URL')
const target = classifySupabaseTarget(supabaseUrl)

if (target === 'LOCAL') {
  console.log('check:env: Supabase target: LOCAL stack (127.0.0.1).')
} else if (target === 'DEV') {
  console.log(`check:env: Supabase target: DEV project (${DEV_PROJECT_REF}) — safe for local writes.`)
} else if (target === 'PROD' || target === 'UNKNOWN') {
  console.warn(
    'check:env: WARNING — Supabase target is NOT the local stack or the dev project.\n' +
      `  NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}\n` +
      '  Writes from here hit real, non-local data. Point .env.development.local at the\n' +
      `  DEV project (${DEV_PROJECT_REF}) unless this is deliberate.`,
  )
}
