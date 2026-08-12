/**
 * One definition of how this repo reads `.env*` files from plain `node`.
 *
 * Plain `node` does not auto-load env files, so every script here had its own
 * copy of a loader, and the copies encoded the file ORDER independently. That
 * order is a safety property in this repo — `.env.development.local` holds DEV
 * credentials and `.env.local` holds PROD ones — so four copies of it is four
 * chances to drift. 2608-DEV-730: `scripts/check-env.js` had drifted, resolving
 * files ahead of `process.env` and ignoring `NODE_ENV` entirely.
 *
 * The order below is Next.js's, reproduced deliberately (`@next/env`):
 *
 *   1. process.env                     — an exported shell/CI variable wins
 *   2. .env.$(NODE_ENV).local          — NOT loaded when NODE_ENV=production
 *                                        unless the file is .env.production.local
 *   3. .env.local                      — skipped entirely when NODE_ENV=test
 *   4. .env.$(NODE_ENV)
 *   5. .env
 *
 * The consequence that matters: `next dev` and the seed scripts read
 * `.env.development.local`, but `next build` / `next start` (NODE_ENV=production)
 * do NOT — they fall through to `.env.local`. A box configured the recommended
 * way therefore targets DEV in development and PROD in production mode, from the
 * same working tree. `scripts/check-env.js` reports both.
 *
 * Resolution contract: the FIRST source that DEFINES a key wins, even if its
 * value is empty; only a wholly undefined key falls through. `@next/env` assigns
 * only when the key is `=== undefined`, so an exported `KEY=` really does shadow
 * every file and the app really does receive `''`. Callers decide whether an
 * empty winner counts as missing (check-env reports it missing).
 */

const fs = require('fs')
const path = require('path')

const ENV_LINE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/

/**
 * Parse one `KEY=value` line. Returns `null` for blanks, comments and anything
 * else that is not an assignment. Strips one layer of matching quotes.
 */
function parseEnvLine(line) {
  const match = line.match(ENV_LINE)
  if (match === null) return null
  let value = match[2]
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    value = value.slice(1, -1)
  }
  return { name: match[1], value }
}

/**
 * Parse an env file into `{ NAME: value }`. A missing file yields `{}` — every
 * one of these files is gitignored and optional on any given machine.
 */
function parseEnvFile(filePath) {
  const vars = {}
  if (fs.existsSync(filePath) === false) return vars
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const parsed = parseEnvLine(line)
    if (parsed === null) continue
    // First occurrence wins within a file, matching dotenv.
    if (vars[parsed.name] === undefined) vars[parsed.name] = parsed.value
  }
  return vars
}

/**
 * The env files Next.js loads for a given NODE_ENV, highest priority first.
 * `process.env` outranks all of them and is not listed.
 */
function nextEnvFiles(nodeEnv) {
  const env = nodeEnv === undefined || nodeEnv === '' ? 'development' : nodeEnv
  const files = [`.env.${env}.local`]
  // Next.js skips .env.local under test so a test run cannot silently inherit a
  // developer's personal credentials.
  if (env !== 'test') files.push('.env.local')
  files.push(`.env.${env}`, '.env')
  return files
}

/**
 * Build a resolver over `process.env` + the files for `nodeEnv`, WITHOUT
 * mutating `process.env`. Used by check-env to model a resolution it is not
 * running under (production mode while itself running in development).
 *
 * Returns `{ resolve, files }` — `files` are the absolute paths that exist, in
 * priority order, so callers can report what they actually read.
 */
function makeEnvResolver(root, nodeEnv) {
  const candidates = nextEnvFiles(nodeEnv).map((name) => path.join(root, name))
  const present = candidates.filter((filePath) => fs.existsSync(filePath))
  const parsed = present.map((filePath) => parseEnvFile(filePath))

  function resolve(name) {
    const exported = process.env[name]
    if (exported !== undefined) return exported
    for (const vars of parsed) {
      if (vars[name] !== undefined) return vars[name]
    }
    return undefined
  }

  return { resolve, files: present }
}

/**
 * Load the env files for `nodeEnv` into `process.env`, never overwriting a key
 * that is already set. This is what the seed scripts call; it is the mutating
 * twin of makeEnvResolver and reads the same chain in the same order.
 */
function loadEnvFiles(root, nodeEnv) {
  const loaded = []
  for (const name of nextEnvFiles(nodeEnv)) {
    const filePath = path.join(root, name)
    if (fs.existsSync(filePath) === false) continue
    const vars = parseEnvFile(filePath)
    for (const key of Object.keys(vars)) {
      if (process.env[key] === undefined) process.env[key] = vars[key]
    }
    loaded.push(filePath)
  }
  return loaded
}

module.exports = {
  parseEnvLine,
  parseEnvFile,
  nextEnvFiles,
  makeEnvResolver,
  loadEnvFiles,
}
