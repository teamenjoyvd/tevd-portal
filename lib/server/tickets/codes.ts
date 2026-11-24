import { randomBytes, randomInt } from 'crypto'

/** No 0/O or 1/I: codes are read aloud and typed at a door. */
export const UNLOCK_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function generateUnlockCode(): string {
  return Array.from({ length: 8 }, () => UNLOCK_CODE_ALPHABET[randomInt(UNLOCK_CODE_ALPHABET.length)]).join('')
}

/** The QR image encodes this token only, with no URL. */
export function generateQrToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Codes are stored upper-case, so typed input is compared case-insensitively. */
export function normalizeUnlockCode(input: string): string {
  return input.trim().toUpperCase()
}
