import { headers } from 'next/headers'

/**
 * Resolve the app's public base URL, without a trailing slash.
 *
 * Prefers `NEXT_PUBLIC_APP_URL` (set in every deployed environment); falls back
 * to the incoming request's `Host` header for local/dev where that env var is
 * unset. `http` is used only for localhost — everything else is `https`.
 *
 * Server-only (reads `next/headers`). Callers must `await` it.
 */
export async function getBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  const host = (await headers()).get('host') ?? 'tevd-portal.vercel.app'
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  return `${isLocal ? 'http' : 'https'}://${host}`
}
