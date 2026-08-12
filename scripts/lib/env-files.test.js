import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * 2608-DEV-730 — `npm run check:env` reported a safe Supabase target while a
 * production-mode command would have used PROD.
 *
 * The cause was not a wrong value but a wrong CHAIN: check-env read
 * `.env.development.local` unconditionally, whereas Next.js picks
 * `.env.$(NODE_ENV).local` and skips the development file entirely under
 * `next build` / `next start`. These tests pin the chain itself, because that is
 * the part no amount of running the script in development mode can exercise.
 *
 * First scripts/**\/*.test.js in the repo — vitest.config.ts already includes
 * that glob, so no config change. Style follows lib/*.test.ts.
 */

import { nextEnvFiles, makeEnvResolver, loadEnvFiles, parseEnvLine } from './env-files'
import { classifySupabaseTarget } from './safe-supabase-target'

const DEV_REF = 'iymwxdewcpvpjgzewtzk'
const PROD_REF = 'ynykjpnetfwqzdnsgkkg'

let root
const savedEnv = { ...process.env }

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'env-files-test-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  // loadEnvFiles mutates process.env by design; every test starts clean.
  process.env = { ...savedEnv }
})

function write(name, contents) {
  fs.writeFileSync(path.join(root, name), contents)
}

describe('nextEnvFiles', () => {
  it('puts .env.$(NODE_ENV).local first and keeps Next.js order', () => {
    expect(nextEnvFiles('development')).toEqual([
      '.env.development.local',
      '.env.local',
      '.env.development',
      '.env',
    ])
  })

  it('does NOT include .env.development.local in production mode', () => {
    const files = nextEnvFiles('production')
    expect(files).toEqual(['.env.production.local', '.env.local', '.env.production', '.env'])
    expect(files).not.toContain('.env.development.local')
  })

  it('skips .env.local under test, as Next.js does', () => {
    expect(nextEnvFiles('test')).not.toContain('.env.local')
  })

  it('defaults to development when NODE_ENV is unset or empty', () => {
    expect(nextEnvFiles(undefined)).toEqual(nextEnvFiles('development'))
    expect(nextEnvFiles('')).toEqual(nextEnvFiles('development'))
  })
})

describe('makeEnvResolver', () => {
  it('is the whole 2608-DEV-730 bug: dev and production modes resolve different projects', () => {
    write('.env.development.local', `NEXT_PUBLIC_SUPABASE_URL=https://${DEV_REF}.supabase.co\n`)
    write('.env.local', `NEXT_PUBLIC_SUPABASE_URL=https://${PROD_REF}.supabase.co\n`)

    const dev = makeEnvResolver(root, 'development').resolve('NEXT_PUBLIC_SUPABASE_URL')
    const prod = makeEnvResolver(root, 'production').resolve('NEXT_PUBLIC_SUPABASE_URL')

    expect(classifySupabaseTarget(dev)).toBe('DEV')
    expect(classifySupabaseTarget(prod)).toBe('PROD')
  })

  it('lets an exported variable outrank every file', () => {
    write('.env.development.local', 'FOO=from-file\n')
    process.env.FOO = 'from-shell'
    expect(makeEnvResolver(root, 'development').resolve('FOO')).toBe('from-shell')
  })

  it('lets a DEFINED-but-empty value win instead of falling through', () => {
    // An exported `FOO=` really does reach the app as '' — @next/env assigns
    // only when the key is `=== undefined`. Falling through here would certify
    // a value nobody receives.
    write('.env.local', 'FOO=from-file\n')
    process.env.FOO = ''
    expect(makeEnvResolver(root, 'development').resolve('FOO')).toBe('')
  })

  it('returns undefined for a key no source defines', () => {
    expect(makeEnvResolver(root, 'development').resolve('NOPE')).toBeUndefined()
  })

  it('does not mutate process.env', () => {
    write('.env.local', 'ONLY_IN_FILE=x\n')
    makeEnvResolver(root, 'development').resolve('ONLY_IN_FILE')
    expect(process.env.ONLY_IN_FILE).toBeUndefined()
  })

  it('reports only the files that exist, in priority order', () => {
    write('.env.local', 'A=1\n')
    write('.env', 'A=2\n')
    expect(makeEnvResolver(root, 'development').files).toEqual([
      path.join(root, '.env.local'),
      path.join(root, '.env'),
    ])
  })
})

describe('loadEnvFiles', () => {
  it('never overwrites an already-set variable', () => {
    write('.env.development.local', 'FOO=from-file\n')
    process.env.FOO = 'from-shell'
    loadEnvFiles(root, 'development')
    expect(process.env.FOO).toBe('from-shell')
  })

  it('applies the higher-priority file when both define a key', () => {
    write('.env.development.local', 'FOO=dev-local\n')
    write('.env.local', 'FOO=local\n')
    loadEnvFiles(root, 'development')
    expect(process.env.FOO).toBe('dev-local')
  })
})

describe('parseEnvLine', () => {
  it('ignores comments, blanks and non-assignments', () => {
    expect(parseEnvLine('# comment')).toBeNull()
    expect(parseEnvLine('')).toBeNull()
    expect(parseEnvLine('not an assignment')).toBeNull()
  })

  it('strips one layer of matching quotes but keeps inner ones', () => {
    expect(parseEnvLine('A="x"')).toEqual({ name: 'A', value: 'x' })
    expect(parseEnvLine("A='x'")).toEqual({ name: 'A', value: 'x' })
    expect(parseEnvLine('A="x')).toEqual({ name: 'A', value: '"x' })
  })

  it('keeps an empty assignment as an empty string, not null', () => {
    expect(parseEnvLine('A=')).toEqual({ name: 'A', value: '' })
  })
})

describe('classifySupabaseTarget', () => {
  it('matches the project on the HOST, not as a substring', () => {
    // The whole reason scripts/lib/safe-supabase-target.js exists: a substring
    // test called this DEV and check-env printed "safe for local writes".
    expect(classifySupabaseTarget(`https://${DEV_REF}.supabase.co.evil.example`)).toBe('UNKNOWN')
    expect(classifySupabaseTarget(`https://evil.example/?ref=${DEV_REF}`)).toBe('UNKNOWN')
  })

  it('names the three known targets', () => {
    expect(classifySupabaseTarget('http://127.0.0.1:54321')).toBe('LOCAL')
    expect(classifySupabaseTarget(`https://${DEV_REF}.supabase.co`)).toBe('DEV')
    expect(classifySupabaseTarget(`https://${PROD_REF}.supabase.co`)).toBe('PROD')
  })

  it('rejects a hosted target over plaintext http', () => {
    expect(classifySupabaseTarget(`http://${PROD_REF}.supabase.co`)).toBe('UNKNOWN')
  })

  it('distinguishes unset from unparseable', () => {
    expect(classifySupabaseTarget('')).toBe('UNSET')
    expect(classifySupabaseTarget(undefined)).toBe('UNSET')
    expect(classifySupabaseTarget('not a url')).toBe('UNKNOWN')
  })
})
