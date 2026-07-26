import { afterEach, describe, expect, it } from 'vitest'
import { getBaseUrl } from '@/lib/utils/base-url'

const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL
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
})
