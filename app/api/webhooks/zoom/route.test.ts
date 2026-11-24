import { createHmac } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { zoom_ref: string; status: string; attended_online_at: string | null; zoom_left_at: string | null }
let row: Row
let failWrites = false
const writes = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      update: (patch: Partial<Row>) => {
        const filters: ((r: Row) => boolean)[] = []
        const query = {
          eq: (c: keyof Row, v: unknown) => (filters.push((r) => r[c] === v), query),
          is: (c: keyof Row, v: unknown) => (filters.push((r) => r[c] === v), query),
          lte: (c: keyof Row, v: string) => (filters.push((r) => r[c] !== null && String(r[c]) <= v), query),
          then: (resolve: (v: unknown) => void) => {
            if (!failWrites && filters.every((f) => f(row))) {
              writes(patch)
              Object.assign(row, patch)
            }
            resolve({ error: failWrites ? { message: 'down' } : null })
          },
        }
        return query
      },
    }),
  }),
}))

const { POST } = await import('./route')
const SECRET = 'whsec'
const now = () => Math.floor(Date.now() / 1000)

function send(body: unknown, { timestamp = String(now()), secret = SECRET } = {}) {
  const raw = JSON.stringify(body)
  const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${raw}`).digest('hex')}`
  return POST(
    new Request('http://localhost/api/webhooks/zoom', {
      method: 'POST',
      body: raw,
      headers: { 'x-zm-request-timestamp': timestamp, 'x-zm-signature': signature },
    }),
  )
}
const participant = (event: string, fields: object) => ({ event, payload: { object: { participant: { registrant_id: 'r1', ...fields } } } })
const joined = (join_time: string) => participant('webinar.participant_joined', { join_time })
const left = (leave_time: string) => participant('webinar.participant_left', { leave_time })

beforeEach(() => {
  vi.stubEnv('ZOOM_WEBHOOK_SECRET_TOKEN', SECRET)
  row = { zoom_ref: 'r1', status: 'active', attended_online_at: null, zoom_left_at: null }
  failWrites = false
  writes.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

describe('POST /api/webhooks/zoom', () => {
  it('answers URL validation', async () => {
    const res = await send({ event: 'endpoint.url_validation', payload: { plainToken: 'abc' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ plainToken: 'abc', encryptedToken: createHmac('sha256', SECRET).update('abc').digest('hex') })
  })

  it.each([
    ['a wrong signature', { secret: 'other' }],
    ['an old timestamp', { timestamp: String(now() - 301) }],
    ['a future timestamp', { timestamp: String(now() + 310) }],
    ['a bad timestamp', { timestamp: 'x' }],
  ])('rejects %s', async (_label, options) => {
    expect((await send(joined('2026-11-24T18:00:00Z'), options)).status).toBe(401)
    expect(writes).not.toHaveBeenCalled()
  })

  it('does nothing without a secret', async () => {
    vi.stubEnv('ZOOM_WEBHOOK_SECRET_TOKEN', '')
    expect((await send(joined('2026-11-24T18:00:00Z'), { secret: '' + 'x' })).status).toBe(503)
  })

  it('records the first join; a redelivery changes nothing', async () => {
    await send(joined('2026-11-24T18:00:00Z'))
    await send(joined('2026-11-24T18:00:00Z'))
    expect(row.attended_online_at).toBe('2026-11-24T18:00:00.000Z')
    expect(writes).toHaveBeenCalledTimes(1)
  })

  it('records leaving, and coming back clears it', async () => {
    await send(joined('2026-11-24T18:00:00Z'))
    await send(left('2026-11-24T18:10:00Z'))
    expect(row.zoom_left_at).toBe('2026-11-24T18:10:00.000Z')
    // A late redelivery of the first join must not cancel the departure.
    await send(joined('2026-11-24T18:00:00Z'))
    expect(row.zoom_left_at).not.toBeNull()
    await send(joined('2026-11-24T18:11:00Z'))
    expect(row.zoom_left_at).toBeNull()
    expect(row.attended_online_at).toBe('2026-11-24T18:00:00.000Z')
  })

  it('ignores unknown events, other people and missing ids', async () => {
    expect((await send({ event: 'webinar.ended', payload: {} })).status).toBe(200)
    expect((await send(participant('webinar.participant_joined', { registrant_id: 'r2', join_time: '2026-11-24T18:00:00Z' }))).status).toBe(200)
    expect((await send(participant('webinar.participant_joined', { registrant_id: '' }))).status).toBe(200)
    expect(writes).not.toHaveBeenCalled()
  })

  it('asks Zoom to retry when the write fails', async () => {
    failWrites = true
    expect((await send(joined('2026-11-24T18:00:00Z'))).status).toBe(500)
  })
})
