import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const importAllSeries = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/server/zoom/sessions', () => ({ importAllSeries: () => importAllSeries() }))

const { POST } = await import('./route')
const post = (job: string, secret?: string) =>
  POST(
    new Request(`http://localhost/api/internal/jobs/${job}`, { method: 'POST', headers: secret === undefined ? {} : { 'x-sync-secret': secret } }),
    { params: Promise.resolve({ job }) },
  )

beforeEach(() => {
  vi.stubEnv('SYNC_SECRET', 's3cret')
  importAllSeries.mockReset().mockResolvedValue({ series: 2, problems: 0 })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('POST /api/internal/jobs/[job]', () => {
  it.each([undefined, '', 'wrong', 's3cret-and-more'])('refuses secret %s', async (secret) => {
    expect((await post('zoom-import-sessions', secret)).status).toBe(401)
    expect(importAllSeries).not.toHaveBeenCalled()
  })

  it('refuses everything while SYNC_SECRET is unset', async () => {
    vi.stubEnv('SYNC_SECRET', '')
    expect((await post('zoom-import-sessions', '')).status).toBe(401)
  })

  it.each(['nope', 'constructor', '__proto__'])('has no job %s', async (job) => {
    expect((await post(job, 's3cret')).status).toBe(404)
  })

  it('runs the job', async () => {
    const res = await post('zoom-import-sessions', 's3cret')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, result: { series: 2, problems: 0 } })
  })

  it('reports a failure without details', async () => {
    importAllSeries.mockRejectedValue(new Error('ann@example.com'))
    const res = await post('zoom-import-sessions', 's3cret')
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('ann@')
  })
})
