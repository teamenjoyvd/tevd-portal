import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getBaseUrl } from '@/lib/utils/base-url'

// Every var getBaseUrl reads, snapshotted together: a test that sets only some
// of them would otherwise inherit whatever the previous test left behind, and
// on a real Vercel runner the VERCEL_* vars are genuinely present in the
// ambient environment.
const VARS = ['NEXT_PUBLIC_APP_URL', 'VERCEL_ENV', 'VERCEL_BRANCH_URL', 'VERCEL_URL'] as const
const ORIGINAL = Object.fromEntries(VARS.map((k) => [k, process.env[k]]))

beforeEach(() => {
  for (const k of VARS) delete process.env[k]
})

afterEach(() => {
  for (const k of VARS) {
    const value = ORIGINAL[k]
    if (value === undefined) delete process.env[k]
    else process.env[k] = value
  }
})

describe('getBaseUrl', () => {
  it('returns the configured URL with a trailing slash stripped', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://portal.example/'
    await expect(getBaseUrl()).resolves.toBe('https://portal.example')
  })

  it('throws when NEXT_PUBLIC_APP_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    await expect(getBaseUrl()).rejects.toThrow('NEXT_PUBLIC_APP_URL is not set')
  })

  it('throws when NEXT_PUBLIC_APP_URL is empty', async () => {
    process.env.NEXT_PUBLIC_APP_URL = '   '
    await expect(getBaseUrl()).rejects.toThrow('NEXT_PUBLIC_APP_URL is not set')
  })

  it('throws when NEXT_PUBLIC_APP_URL is slash-only', async () => {
    process.env.NEXT_PUBLIC_APP_URL = '////'
    await expect(getBaseUrl()).rejects.toThrow('NEXT_PUBLIC_APP_URL is not set')
  })
})

// -- Vercel fallback (2608-DEV-713) -------------------------------------------
// A Preview deployment missing NEXT_PUBLIC_APP_URL used to throw, which took
// the guest magic link — and the whole registration action — down with it.

describe('getBaseUrl — Vercel fallback', () => {
  it('prefers NEXT_PUBLIC_APP_URL over the platform vars', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://portal.example'
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_BRANCH_URL = 'branch.vercel.app'
    await expect(getBaseUrl()).resolves.toBe('https://portal.example')
  })

  it('falls back to VERCEL_BRANCH_URL on a preview deployment', async () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_BRANCH_URL = 'site-git-my-branch.vercel.app'
    await expect(getBaseUrl()).resolves.toBe('https://site-git-my-branch.vercel.app')
  })

  it('prefers the branch URL over the per-deployment URL', async () => {
    // The branch URL survives the next redeploy; VERCEL_URL does not, so a
    // magic link built from it would rot in the guest's inbox.
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_BRANCH_URL = 'site-git-my-branch.vercel.app'
    process.env.VERCEL_URL = 'site-abc123.vercel.app'
    await expect(getBaseUrl()).resolves.toBe('https://site-git-my-branch.vercel.app')
  })

  it('falls back to VERCEL_URL when no branch URL is present', async () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_URL = 'site-abc123.vercel.app'
    await expect(getBaseUrl()).resolves.toBe('https://site-abc123.vercel.app')
  })

  it('falls back on a development deployment too', async () => {
    process.env.VERCEL_ENV = 'development'
    process.env.VERCEL_URL = 'site-abc123.vercel.app'
    await expect(getBaseUrl()).resolves.toBe('https://site-abc123.vercel.app')
  })

  it('still throws in production — a *.vercel.app link must never reach an inbox', async () => {
    process.env.VERCEL_ENV = 'production'
    process.env.VERCEL_BRANCH_URL = 'site-git-main.vercel.app'
    process.env.VERCEL_URL = 'site-abc123.vercel.app'
    await expect(getBaseUrl()).rejects.toThrow('NEXT_PUBLIC_APP_URL is not set')
  })

  it('still throws off-platform, where VERCEL_ENV is unset', async () => {
    // The allowlist is positive on purpose: an unknown/absent VERCEL_ENV must
    // not enable the fallback even if a stray VERCEL_URL is in the environment.
    process.env.VERCEL_URL = 'site-abc123.vercel.app'
    await expect(getBaseUrl()).rejects.toThrow('NEXT_PUBLIC_APP_URL is not set')
  })
})
