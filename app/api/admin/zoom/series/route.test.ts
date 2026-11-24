import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZoomError } from '@/lib/server/zoom/client'

const mockAuth = vi.fn()
const mockImport = vi.fn()
let role = 'admin'

vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/server/zoom/sessions', () => ({ importSeries: (...args: unknown[]) => mockImport(...args) }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) =>
      table === 'ticket_products'
        ? { select: () => ({ not: async () => ({ data: [{ series_key: 'tuesday' }, { series_key: 'tuesday' }, { series_key: 'monday' }], error: null }) }) }
        : { select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'p', role } }) }) }) },
  }),
}))

const { GET, POST } = await import('./route')
const valid = { series_key: 'tuesday', zoom_id: '123 4567 8901', event_type: 'hybrid', in_person_capacity: null, online_capacity: 100 }
const post = (body: unknown) => POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  role = 'admin'
  mockAuth.mockReset().mockResolvedValue({ userId: 'u1' })
  mockImport.mockReset().mockResolvedValue({ ok: true, created: 1, updated: 0, future: 1, vanished: [] })
  for (const name of ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET']) vi.stubEnv(name, 'x')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('/api/admin/zoom/series', () => {
  it('refuses a signed-out caller', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    expect((await GET()).status).toBe(401)
    expect((await post(valid)).status).toBe(401)
  })

  it.each(['core', 'member', 'guest'])('refuses %s', async (r) => {
    role = r
    expect((await GET()).status).toBe(403)
    expect((await post(valid)).status).toBe(403)
    expect(mockImport).not.toHaveBeenCalled()
  })

  it('lists each series key once', async () => {
    expect(await (await GET()).json()).toEqual({ configured: true, series_keys: ['monday', 'tuesday'] })
  })

  it('is off without Zoom settings', async () => {
    vi.stubEnv('ZOOM_CLIENT_ID', '')
    expect(await (await GET()).json()).toMatchObject({ configured: false })
    expect((await post(valid)).status).toBe(503)
    expect(mockImport).not.toHaveBeenCalled()
  })

  it.each([
    ['series', { ...valid, series_key: 'friday' }],
    ['id', { ...valid, zoom_id: '12/../34' }],
    ['type', { ...valid, event_type: 'x' }],
    ['capacity', { ...valid, online_capacity: 101 }],
    ['body', null],
  ])('rejects an invalid %s', async (_label, body) => {
    expect((await post(body)).status).toBe(400)
    expect(mockImport).not.toHaveBeenCalled()
  })

  it('links, with spaces removed from the id', async () => {
    expect((await post(valid)).status).toBe(200)
    expect(mockImport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventRef: '12345678901', seriesKey: 'tuesday' }))
  })

  it('reports a refused webinar', async () => {
    mockImport.mockResolvedValue({ ok: false, code: 'wrong_settings' })
    const res = await post(valid)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'wrong_settings' })
  })

  it.each([[403, 'not_allowed'], [404, 'not_found'], [500, 'zoom_error']])('maps Zoom %i to %s', async (status, code) => {
    mockImport.mockRejectedValue(new ZoomError('permanent', status))
    expect(await (await post(valid)).json()).toMatchObject({ code })
  })
})
