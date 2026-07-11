// fetch() only rejects on network failure — a 4xx/5xx response still resolves
// with a parseable JSON error body (e.g. { error: 'Unauthorized' }), which
// would otherwise be treated as valid query/mutation data (an object, not an
// array) and crash any `.filter`/`.map` caller downstream.
//
// Minimal by design: unlike `lib/apiClient.ts` it performs no 401 redirect and
// sets no headers, so converting a call site changes nothing but the non-ok
// path (which now throws instead of returning the error body as data).
export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}
