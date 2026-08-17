// fetch() only rejects on network failure — a 4xx/5xx response still resolves
// with a parseable JSON error body (e.g. { error: 'Unauthorized' }), which
// would otherwise be treated as valid query/mutation data (an object, not an
// array) and crash any `.filter`/`.map` caller downstream.
//
// Minimal by design: unlike `lib/apiClient.ts` it performs no 401 redirect and
// sets no headers, so converting a call site changes nothing but the non-ok
// path (which now throws instead of returning the error body as data).
//
// It throws `ApiError` rather than a bare `Error` (2608-DEV-751) so callers can
// branch on the route's machine-readable `code` — the admin approval hub used to
// show one hardcoded English string for every failure because a plain `Error`
// dropped it. `ApiError extends Error` and the message is unchanged, so the
// twelve existing call sites are unaffected.
import { ApiError } from '@/lib/api-error'

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    // Deliberately `body?.error` only, with no `body?.message` fallback: that is
    // this wrapper's long-standing contract (see its tests) and differs from
    // apiClient's on purpose.
    const code = typeof body?.code === 'string' ? body.code : undefined
    throw new ApiError(res.status, body?.error ?? `Request failed: ${res.status}`, code)
  }
  return res.json()
}
