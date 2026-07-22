// ── lib/server/icalToken.ts ──────────────────────────────────────────────────
// Shared ICAL_TOKEN_SECRET + JWT sign/verify for the iCal feed subscription.
// Used by: app/api/calendar/feed.ics/route.ts, app/api/calendar/feed-token/route.ts.
// Fails closed: throws IcalTokenConfigError when ICAL_TOKEN_SECRET is unset,
// instead of falling back to a hardcoded dev secret.
import { SignJWT, jwtVerify } from 'jose'

export class IcalTokenConfigError extends Error {}

function getSecret(): Uint8Array {
  const raw = process.env.ICAL_TOKEN_SECRET
  if (raw === undefined || raw === '') {
    throw new IcalTokenConfigError('ICAL_TOKEN_SECRET is not set')
  }
  return new TextEncoder().encode(raw)
}

export async function signIcalToken(payload: { profile_id: string; role: string }): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).sign(getSecret())
}

export async function verifyIcalToken(token: string): Promise<{ profile_id: string }> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as { profile_id: string }
}
