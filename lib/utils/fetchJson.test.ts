import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchJson } from '@/lib/utils/fetchJson'

function mockFetchOnce(response: Response): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchJson', () => {
  it('returns the parsed JSON body on an ok response', async () => {
    mockFetchOnce(new Response(JSON.stringify([{ id: '1' }]), { status: 200 }))
    await expect(fetchJson<{ id: string }[]>('/api/notifications')).resolves.toEqual([{ id: '1' }])
  })

  it('passes input and init through to fetch', async () => {
    const mock = mockFetchOnce(new Response('{}', { status: 200 }))
    const init = { method: 'PATCH', body: JSON.stringify({ is_read: true }) }
    await fetchJson('/api/notifications/1', init)
    expect(mock).toHaveBeenCalledWith('/api/notifications/1', init)
  })

  it('throws the server-provided error message on a non-ok response', async () => {
    mockFetchOnce(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }))
    await expect(fetchJson('/api/notifications')).rejects.toThrow('Unauthorized')
  })

  it('falls back to the status code when the error body has no error field', async () => {
    mockFetchOnce(new Response(JSON.stringify({ message: 'nope' }), { status: 500 }))
    await expect(fetchJson('/api/notifications')).rejects.toThrow('Request failed: 500')
  })

  it('falls back to the status code when the error body is not JSON', async () => {
    mockFetchOnce(new Response('<html>Bad Gateway</html>', { status: 502 }))
    await expect(fetchJson('/api/notifications')).rejects.toThrow('Request failed: 502')
  })

  it('does not treat a JSON error body on a 200 as a failure', async () => {
    mockFetchOnce(new Response(JSON.stringify({ error: 'soft error payload' }), { status: 200 }))
    await expect(fetchJson('/api/x')).resolves.toEqual({ error: 'soft error payload' })
  })
})
