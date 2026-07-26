/**
 * Resolve the app's public base URL, without a trailing slash.
 *
 * Requires `NEXT_PUBLIC_APP_URL` (set in every deployed environment). Throws
 * rather than falling back to the incoming request's `Host` header, which is
 * attacker-controlled and must never be trusted for externally-visible links
 * (email `actionUrl`, ICS feed subscription URL, magic links).
 */
export async function getBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured === undefined || configured === '') {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is not set. Set it in .env.local to build absolute links locally.'
    )
  }
  return configured.replace(/\/+$/, '')
}
