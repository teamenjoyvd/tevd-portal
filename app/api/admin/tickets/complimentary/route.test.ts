import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.fn()
const mockRpc = vi.fn()
let role = 'admin'

vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'p_admin', role } }) }) }) }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}))

const { POST } = await import('./route')

const valid = {
  product_id: '11111111-1111-4111-8111-111111111111',
  name: ' Ann ',
  email: 'ann@example.com',
  entries: 2,
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
}
const post = (body: unknown) =>
  POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  role = 'admin'
  mockAuth.mockReset().mockResolvedValue({ userId: 'u1' })
  mockRpc.mockReset().mockResolvedValue({
    data: { id: 'pass', unlock_code: 'ABCD2345', qr_token: 'secret', holder_name: 'Ann', entries_total: 2, expires_at: valid.expires_at },
    error: null,
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/admin/tickets/complimentary', () => {
  it('refuses a signed-out caller', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    expect((await post(valid)).status).toBe(401)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it.each(['core', 'member', 'guest'])('refuses %s', async (r) => {
    role = r
    expect((await post(valid)).status).toBe(403)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it.each([
    ['no body', null],
    ['product', { ...valid, product_id: 'x' }],
    ['name', { ...valid, name: '  ' }],
    ['email', { ...valid, email: 'ann' }],
    ['entries', { ...valid, entries: 0 }],
    ['fractional entries', { ...valid, entries: 1.5 }],
    ['too many entries', { ...valid, entries: 101 }],
    ['past expiry', { ...valid, expires_at: '2020-01-01T00:00:00Z' }],
    ['bad expiry', { ...valid, expires_at: 'soon' }],
  ])('rejects an invalid %s', async (_label, body) => {
    expect((await post(body)).status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('issues the pass as the calling admin and never returns the QR token', async () => {
    const res = await post(valid)
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ unlock_code: 'ABCD2345' })
    expect(JSON.stringify(await (await post(valid)).json())).not.toContain('secret')
    expect(mockRpc).toHaveBeenCalledWith(
      'issue_complimentary_pass',
      expect.objectContaining({ p_actor: 'p_admin', p_name: 'Ann', p_entries: 2 }),
    )
  })

  it('maps an unknown product to 404 and an unexpected error to 500', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'TK011', message: '' } })
    expect((await post(valid)).status).toBe(404)
    mockRpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'private detail' } })
    const res = await post(valid)
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('private detail')
  })
})
