import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * 2608-DEV-727 — a transient 401 during a Clerk token refresh must not evict a
 * live session.
 *
 * The race cannot be forced by hand (it depends on hitting the refresh window),
 * which is why it went undiagnosed as CI flake for so long. Here the seam is
 * mocked instead: `getToken` decides "refresh race" vs "really signed out", and
 * `fetch` decides whether the replay succeeds. Everything the fix promises is
 * expressible in those two.
 *
 * Every test loads a FRESH copy of the module: the single-flight promise and
 * the redirect latch are module-level state, and a leaked latch would make a
 * later test pass for the wrong reason.
 */

const getToken = vi.fn<(options?: { skipCache?: boolean }) => Promise<string | null>>()
vi.mock('@clerk/nextjs', () => ({
  getToken: (options?: { skipCache?: boolean }) => getToken(options),
}))

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()

/** Every assignment is recorded, so "redirected ONCE" is assertable, not assumed. */
let hrefWrites: string[] = []
const windowStub = {
  location: {
    get href() { return hrefWrites[hrefWrites.length - 1] ?? '' },
    set href(value: string) { hrefWrites.push(value) },
  },
}

function json(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * A Response body can be read once. Real `fetch` hands back a fresh one per
 * call, so any mock standing in for repeated calls must construct per call too
 * — `mockResolvedValue(json(...))` replays one spent instance and fails with
 * "Body is unusable" on the second read.
 */
function alwaysJson(status: number, body: unknown = {}) {
  return async () => json(status, body)
}

async function loadClient() {
  vi.resetModules()
  return import('./apiClient')
}

beforeEach(() => {
  hrefWrites = []
  getToken.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('window', windowStub)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiClient 401 handling', () => {
  it('refreshes the session and replays once, without redirecting', async () => {
    getToken.mockResolvedValue('fresh-token')
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'Unauthorized' }))
      .mockResolvedValueOnce(json(200, { id: 'p1' }))

    const { apiClient } = await loadClient()

    await expect(apiClient<{ id: string }>('/api/profile')).resolves.toEqual({ id: 'p1' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getToken).toHaveBeenCalledWith({ skipCache: true })
    expect(hrefWrites).toEqual([])
  })

  it('redirects when the replay 401s too — a fresh token did not help', async () => {
    getToken.mockResolvedValue('fresh-token')
    fetchMock.mockImplementation(alwaysJson(401, { error: 'Unauthorized' }))

    const { apiClient, ApiError } = await loadClient()

    await expect(apiClient('/api/profile')).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(hrefWrites).toEqual(['/sign-in'])
  })

  it('redirects without replaying when Clerk reports no session', async () => {
    // null is Clerk's own "not signed in" answer — the genuine expiry case.
    getToken.mockResolvedValue(null)
    fetchMock.mockResolvedValueOnce(json(401, { error: 'Unauthorized' }))

    const { apiClient } = await loadClient()

    await expect(apiClient('/api/profile')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(hrefWrites).toEqual(['/sign-in'])
  })

  it('does not evict the session when the refresh itself fails', async () => {
    // ClerkOfflineError / clerk_runtime_load_timeout: Clerk broke, which says
    // nothing about whether the user is signed in.
    getToken.mockRejectedValue(new Error('clerk_offline'))
    fetchMock.mockResolvedValueOnce(json(401, { error: 'Unauthorized' }))

    const { apiClient } = await loadClient()

    await expect(apiClient('/api/profile')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(hrefWrites).toEqual([])
  })

  it('a concurrent burst refreshes once and recovers every call', async () => {
    // The reported shape: five endpoints 401 within 5ms right after a reload.
    getToken.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('fresh-token'), 5)),
    )
    let call = 0
    fetchMock.mockImplementation(async () => (++call <= 5 ? json(401) : json(200, { ok: true })))

    const { apiClient } = await loadClient()

    const results = await Promise.all([
      apiClient<{ ok: boolean }>('/api/profile'),
      apiClient<{ ok: boolean }>('/api/calendar/feed-token'),
      apiClient<{ ok: boolean }>('/api/profile/event-roles'),
      apiClient<{ ok: boolean }>('/api/profile/vital-signs'),
      apiClient<{ ok: boolean }>('/api/profile/payments'),
    ])

    expect(results).toEqual(Array(5).fill({ ok: true }))
    expect(getToken).toHaveBeenCalledTimes(1)
    expect(hrefWrites).toEqual([])
  })

  it('a burst that is really signed out redirects exactly once', async () => {
    getToken.mockResolvedValue(null)
    fetchMock.mockImplementation(alwaysJson(401))

    const { apiClient } = await loadClient()

    const settled = await Promise.allSettled(
      Array.from({ length: 5 }, () => apiClient('/api/profile')),
    )

    expect(settled.every(r => r.status === 'rejected')).toBe(true)
    expect(hrefWrites).toEqual(['/sign-in'])
  })
})

describe('apiClient non-401 behaviour is unchanged', () => {
  it('surfaces the JSON error body on a 400', async () => {
    fetchMock.mockResolvedValueOnce(json(400, { error: 'This event has already ended.' }))

    const { apiClient } = await loadClient()

    await expect(apiClient('/api/events/e1/attend', { method: 'POST', body: '{}' })).rejects
      .toMatchObject({ status: 400, message: 'This event has already ended.' })
    expect(getToken).not.toHaveBeenCalled()
  })

  /**
   * 2608-DEV-733: the client half of the machine-readable failure contract. The
   * server half is covered in `lib/server/member-registration.test.ts`; this is
   * the only place asserting the code actually survives the fetch wrapper and
   * reaches the caller that switches on it.
   */
  it('carries a string `code` from the error body onto ApiError, and ignores a non-string one', async () => {
    fetchMock
      .mockResolvedValueOnce(json(400, { error: 'This event is full.', code: 'event_full' }))
      .mockResolvedValueOnce(json(400, { error: 'This event is full.', code: 42 }))

    const { apiClient } = await loadClient()

    await expect(apiClient('/api/events/e1/attend', { method: 'POST', body: '{}' })).rejects
      .toMatchObject({ status: 400, code: 'event_full' })
    await expect(apiClient('/api/events/e1/attend', { method: 'POST', body: '{}' })).rejects
      .toMatchObject({ status: 400, code: undefined })
  })

  it('sets Content-Type for a JSON body but not for FormData', async () => {
    fetchMock.mockImplementation(alwaysJson(200, {}))

    const { apiClient } = await loadClient()

    await apiClient('/api/x', { method: 'POST', body: '{"a":1}' })
    await apiClient('/api/y', { method: 'POST', body: new FormData() })

    const jsonHeaders = fetchMock.mock.calls[0][1]?.headers as Headers
    const formHeaders = fetchMock.mock.calls[1][1]?.headers as Headers
    expect(jsonHeaders.get('Content-Type')).toBe('application/json')
    expect(formHeaders.get('Content-Type')).toBeNull()
  })
})
