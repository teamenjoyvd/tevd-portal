/**
 * Shared fetch wrapper for client-side API calls.
 *
 * Provides:
 * - TypeScript generics (no `any` returns)
 * - `response.ok` check (fetch does not throw on 4xx/5xx)
 * - 401 recovery (refresh the session once, replay once, redirect only on proof
 *   of sign-out — see `recoverFrom401`)
 * - `Content-Type: application/json` header (skipped for FormData or bodyless requests)
 *
 * Client-only — do NOT import in RSC pages, route handlers, or server actions.
 */

import { getToken } from '@clerk/nextjs'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 2608-DEV-727. A 401 is NOT proof that the session ended.
 *
 * `proxy.ts:13-21` answers any API request Clerk cannot resolve a `userId` for
 * with a 401, and that includes the brief window while Clerk is refreshing the
 * session token. A page that issues its API burst inside that window (typically
 * right after a reload) used to be hard-navigated to /sign-in with a perfectly
 * live session: five endpoints 401'd within 5ms and the same endpoint answered
 * 200 seven milliseconds later.
 *
 * So: force one token refresh, replay once, and navigate only when the refresh
 * says the user really is signed out, or when the replay 401s too.
 *
 * Both pieces of state below are module-level ON PURPOSE. The burst is
 * concurrent, so the decision has to be shared across in-flight calls — five
 * independent decisions means the first loser still evicts everyone.
 */
let refreshInFlight: Promise<string | null> | null = null
let redirecting = false

/**
 * Single-flight: a burst of 401s triggers ONE token fetch, and every caller
 * awaits the same promise. Rejections propagate to all awaiters by design —
 * see the call site, where a thrown Clerk error is explicitly not treated as a
 * sign-out.
 */
function refreshSession(): Promise<string | null> {
  if (!refreshInFlight) {
    // getToken(): @clerk/shared 4.25.2 — resolves to the session token, or null
    // when the user is not signed in. skipCache forces the round trip that
    // rewrites the session cookie proxy.ts reads.
    refreshInFlight = getToken({ skipCache: true }).finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

/** Latched: the first caller navigates, the other four in the burst do not. */
function redirectToSignIn(): void {
  if (redirecting) return
  redirecting = true
  window.location.href = '/sign-in'
}

/**
 * Returns true when the caller should replay the request once.
 * Throws `ApiError(401)` when it should not, having redirected if — and only
 * if — the user is genuinely signed out.
 */
async function recoverFrom401(): Promise<boolean> {
  let token: string | null
  try {
    token = await refreshSession()
  } catch {
    // Clerk itself failed: offline, or it never loaded within its timeout
    // (both are documented ClerkRuntimeError/ClerkOfflineError cases). That is
    // not evidence of a sign-out, so do NOT evict the session — surface the 401
    // to the caller and let it show its own error.
    throw new ApiError(401, 'Unauthorized')
  }

  // null is Clerk's own "not signed in" answer — the one signal that justifies
  // throwing the user out.
  if (token === null) {
    redirectToSignIn()
    throw new ApiError(401, 'Unauthorized')
  }
  return true
}

export async function apiClient<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  if (!headers.has('Content-Type') && options?.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const init: RequestInit = { ...options, headers }
  let response = await fetch(url, init)

  if (response.status === 401 && typeof window !== 'undefined') {
    await recoverFrom401()
    // Replaying is safe for every method, not just GET: every 401 reachable
    // from the browser is a pre-side-effect auth guard (proxy.ts:19, and the
    // `if (!userId) return 401` at the top of each app/api handler), so the
    // rejected request wrote nothing. No call site passes a stream body, so
    // `init` is always re-sendable.
    response = await fetch(url, init)
    if (response.status === 401) {
      // A fresh token still gets a 401: this one is real.
      redirectToSignIn()
      throw new ApiError(401, 'Unauthorized')
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      // Reachable only without a `window` (SSR / tests): nothing to refresh and
      // nowhere to navigate.
      throw new ApiError(401, 'Unauthorized')
    }
    const text = await response.text().catch(() => '')
    let message = text
    if (text) {
      try {
        const json = JSON.parse(text)
        message = json?.error ?? json?.message ?? text
      } catch { /* ignore */ }
    }
    throw new ApiError(response.status, message || `API Error: ${response.status}`)
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : {}) as T
}
