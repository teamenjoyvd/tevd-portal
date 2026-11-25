import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { createServiceClient } from '@/lib/supabase/service'
import { generateQrToken, generateUnlockCode, normalizeUnlockCode, UNLOCK_CODE_ALPHABET } from './codes'
import { ticketErrorCode } from './errors'
import { findPass, linkPassToProfile, withFreshCodes } from './passes'
import { healPendingAdmissions, redeem, registerWithZoom, type TicketAdmission } from './redeem'

type Row = Record<string, unknown>
type Rpc = () => { data: unknown; error: unknown }

/** In-memory PostgREST subset: filters, then select / update / insert. */
function fakeDb(tables: Record<string, Row[]>, rpc: Rpc = () => ({ data: [], error: null })) {
  const from = (table: string) => {
    let rows = tables[table] ?? (tables[table] = [])
    let patch: Row | null = null
    const run = () => {
      if (patch !== null) for (const r of rows) Object.assign(r, patch)
      return rows.map((r) => ({ ...r }))
    }
    const keep = (f: (r: Row) => boolean) => {
      rows = rows.filter(f)
      return q
    }
    const q = {
      select: () => q,
      update: (p: Row) => {
        patch = p
        return q
      },
      insert: async (added: Row[]) => {
        tables[table].push(...added)
        return { error: null }
      },
      eq: (k: string, v: unknown) => keep((r) => r[k] === v),
      is: (k: string, v: unknown) => keep((r) => (r[k] ?? null) === v),
      in: (k: string, v: unknown[]) => keep((r) => v.includes(r[k])),
      lt: (k: string, v: string | number) => keep((r) => (r[k] as string | number) < v),
      gte: (k: string, v: string | number) => keep((r) => (r[k] as string | number) >= v),
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => void) => ok({ data: run(), error: null }),
    }
    return q
  }
  return { from, rpc: async () => rpc() } as unknown as ReturnType<typeof createServiceClient>
}

const admission = (over: Partial<TicketAdmission> = {}) =>
  ({
    id: 'a1', pass_id: 'p1', event_id: 'e1', attendee_name: 'Ann', attendee_email: 'ann@example.com',
    mode: 'online', status: 'pending_zoom', zoom_attempts: 0, zoom_attempted_at: null, ...over,
  }) as TicketAdmission
const tableOf = (row: TicketAdmission) => ({ ticket_admissions: [row as unknown as Row] })

const zoom = {
  register: vi.fn<(i: unknown) => Promise<{ ref: string; joinLink: string }>>(),
  cancel: vi.fn<(i: unknown) => Promise<void>>(),
}
beforeEach(() => {
  zoom.register.mockReset().mockResolvedValue({ ref: 'r1', joinLink: 'https://zoom.example/1' })
  zoom.cancel.mockReset().mockResolvedValue(undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('codes', () => {
  it('uses 8 characters of the unambiguous alphabet', () => {
    expect(UNLOCK_CODE_ALPHABET).not.toMatch(/[01OI]/)
    for (let i = 0; i < 200; i++) {
      expect(generateUnlockCode()).toMatch(/^[2-9A-HJ-NP-Z]{8}$/)
    }
  })

  it('has a 32-byte URL-safe QR token', () => {
    const token = generateQrToken()
    expect(token).toMatch(/^[\w-]+$/)
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
  })

  it('normalises typed codes', () => {
    expect(normalizeUnlockCode(' ab2c ')).toBe('AB2C')
  })

  it('retries a collision with fresh codes, and nothing else', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: '' } })
      .mockResolvedValueOnce({ data: 1, error: null })
    expect((await withFreshCodes(run)).data).toBe(1)
    expect(run.mock.calls[0][0].unlockCode).not.toBe(run.mock.calls[1][0].unlockCode)

    const refused = vi.fn().mockResolvedValue({ data: null, error: { code: 'TK010', message: '' } })
    await withFreshCodes(refused)
    expect(refused).toHaveBeenCalledTimes(1)
  })
})

describe('passes', () => {
  const pass = { id: 'p1', holder_email: 'Ann@Example.com' }
  const user = (status: string) => ({ emailAddresses: [{ emailAddress: 'ann@example.com', verification: { status } }] })

  it('finds a void pass by a code typed in lower case, and by QR token', async () => {
    const db = fakeDb({ ticket_passes: [{ id: 'p1', unlock_code: 'ABCD2345', qr_token: 'q', status: 'void' }] })
    expect(await findPass(db, { code: ' abcd2345 ' })).toMatchObject({ status: 'void' })
    expect(await findPass(db, { qrToken: 'q' })).toMatchObject({ id: 'p1' })
    expect(await findPass(db, { code: 'WRONG234' })).toBeNull()
  })

  it('links on a verified matching email', async () => {
    const rows: Row[] = [{ id: 'p1', holder_profile_id: null }]
    expect(await linkPassToProfile(fakeDb({ ticket_passes: rows }), pass, 'prof', user('verified'))).toBe(true)
    expect(rows[0].holder_profile_id).toBe('prof')
  })

  it('does not link on an unverified email', async () => {
    const rows: Row[] = [{ id: 'p1', holder_profile_id: null }]
    expect(await linkPassToProfile(fakeDb({ ticket_passes: rows }), pass, 'prof', user('unverified'))).toBe(false)
    expect(rows[0].holder_profile_id).toBeNull()
  })

  it('never moves a pass another profile holds', async () => {
    const rows: Row[] = [{ id: 'p1', holder_profile_id: 'other' }]
    expect(await linkPassToProfile(fakeDb({ ticket_passes: rows }), pass, 'prof', user('verified'))).toBe(false)
    expect(rows[0].holder_profile_id).toBe('other')
  })
})

describe('redeem', () => {
  const input = {
    passId: 'p1', eventId: 'e1', attendees: [{ name: 'Ann', email: 'ann@example.com' }],
    mode: 'online' as const, admittedVia: 'code' as const, actorId: null,
  }
  const run = (row: TicketAdmission) =>
    redeem({ supabase: fakeDb(tableOf(row), () => ({ data: [{ ...row }], error: null })), zoom }, input)

  it('maps a ticket SQLSTATE and rethrows anything else', async () => {
    const failing = (code: string) =>
      redeem({ supabase: fakeDb({}, () => ({ data: null, error: { code } })), zoom }, input)
    expect(await failing('TK008')).toEqual({ ok: false, code: 'full' })
    await expect(failing('23503')).rejects.toEqual({ code: '23503' })
    expect(ticketErrorCode({ code: 'toString' })).toBeNull()
  })

  it('activates an online admission', async () => {
    expect(await run(admission())).toMatchObject({ ok: true, admissions: [{ status: 'active', zoom_ref: 'r1' }] })
  })

  it('never calls Zoom for a door admission', async () => {
    await run(admission({ mode: 'in_person', status: 'active' }))
    expect(zoom.register).not.toHaveBeenCalled()
  })

  it('a Zoom failure leaves pending_zoom and uses no extra entry', async () => {
    zoom.register.mockRejectedValue(new Error('down'))
    const row = admission()
    const tables = tableOf(row)
    const rpc = vi.fn(() => ({ data: [{ ...row }], error: null }))
    const result = await redeem({ supabase: fakeDb(tables, rpc), zoom }, input)
    expect(result).toMatchObject({ ok: true, admissions: [{ status: 'pending_zoom' }] })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(tables.ticket_admissions).toMatchObject([{ status: 'pending_zoom', zoom_attempts: 1 }])
  })
})

describe('claims and healing', () => {
  const longAgo = () => new Date(Date.now() - 31_000).toISOString()
  const event = (start: number) => ({ id: 'e1', start_time: new Date(start).toISOString() })
  const heal = (
    tables: Record<string, Row[]>,
    { onActive = vi.fn(async () => {}), start = Date.now() } = {},
  ) => healPendingAdmissions({ supabase: fakeDb({ calendar_events: [event(start)], ...tables }), zoom, onActive })

  it('completes a failed registration and tells the attendee once', async () => {
    const row = admission({ zoom_attempts: 1, zoom_attempted_at: longAgo() })
    const onActive = vi.fn(async () => {})
    expect(await heal(tableOf(row), { onActive })).toEqual({ healed: 1 })
    expect(row).toMatchObject({ status: 'active', zoom_ref: 'r1' })
    expect(await heal(tableOf(row), { onActive })).toEqual({ healed: 0 })
    expect(onActive).toHaveBeenCalledTimes(1)
  })

  it("leaves other days' events alone", async () => {
    await heal(tableOf(admission()), { start: Date.now() + 25 * 3_600_000 })
    await heal(tableOf(admission()), { start: Date.now() - 25 * 3_600_000 })
    expect(zoom.register).not.toHaveBeenCalled()
  })

  it('one failing row does not stop the next', async () => {
    zoom.register.mockRejectedValueOnce(new Error('down'))
    const onActive = vi.fn(async () => { throw new Error('mail') })
    const rows = [admission(), admission({ id: 'a2' }), admission({ id: 'a3' })] as unknown as Row[]
    expect(await heal({ ticket_admissions: rows }, { onActive })).toEqual({ healed: 2 })
  })

  it('skips a claim made within 30 seconds', async () => {
    await heal(tableOf(admission({ zoom_attempts: 1, zoom_attempted_at: new Date().toISOString() })))
    expect(zoom.register).not.toHaveBeenCalled()
  })

  it('refuses the third attempt', async () => {
    const row = admission({ zoom_attempts: 2, zoom_attempted_at: longAgo() })
    await heal(tableOf(row))
    expect(await registerWithZoom({ supabase: fakeDb(tableOf(row)), zoom }, row)).toBeNull()
    expect(zoom.register).not.toHaveBeenCalled()
  })

  it('two holders of the same row cannot both claim it', async () => {
    const row = admission()
    const supabase = fakeDb(tableOf(row))
    await Promise.all([
      registerWithZoom({ supabase, zoom }, { ...row }),
      registerWithZoom({ supabase, zoom }, { ...row }),
    ])
    expect(zoom.register).toHaveBeenCalledTimes(1)
  })

  it('alerts admins only when the second attempt fails', async () => {
    zoom.register.mockRejectedValue(new Error('down'))
    const row = admission()
    const tables = {
      ...tableOf(row),
      profiles: [{ id: 'adm', role: 'admin' }, { id: 'mem', role: 'member' }],
      member_notifications: [] as Row[],
    }
    await heal(tables)
    expect(tables.member_notifications).toHaveLength(0)
    row.zoom_attempted_at = longAgo()
    await heal(tables)
    expect(tables.member_notifications).toMatchObject([{ profile_id: 'adm', type: 'ticket_alert' }])
  })

  it('cancels in Zoom when the admission was revoked meanwhile', async () => {
    const row = admission()
    zoom.register.mockImplementation(async () => {
      row.status = 'revoked'
      return { ref: 'r9', joinLink: 'x' }
    })
    expect(await registerWithZoom({ supabase: fakeDb(tableOf(row)), zoom }, row)).toBeNull()
    expect(zoom.cancel).toHaveBeenCalledWith({ eventId: 'e1', ref: 'r9' })
    expect(row.status).toBe('revoked')
  })

  it('cancels when revoked, even with the same reference', async () => {
    const row = admission()
    zoom.register.mockImplementationOnce(async () => {
      Object.assign(row, { status: 'revoked', zoom_ref: 'r1' })
      return { ref: 'r1', joinLink: 'https://zoom.example/1' }
    })
    expect(await registerWithZoom({ supabase: fakeDb(tableOf(row)), zoom }, { ...row })).toBeNull()
    expect(zoom.cancel).toHaveBeenCalledWith({ eventId: 'e1', ref: 'r1' })
  })

  describe('two attempts overlap', () => {
    /** A starts; B, allowed once A's hold is over, starts too. Zoom answers `first`, then the other. */
    async function overlap(refs: { a: string; b: string }, first: 'a' | 'b') {
      const row = admission()
      const supabase = fakeDb(tableOf(row))
      const answer: Record<string, () => void> = {}
      for (const key of ['a', 'b'] as const) {
        zoom.register.mockImplementationOnce(
          () => new Promise((resolve) => { answer[key] = () => resolve({ ref: refs[key], joinLink: `https://zoom.example/${refs[key]}` }) }),
        )
      }
      const asked = (key: string) => vi.waitFor(() => expect(answer[key]).toBeDefined())
      const a = registerWithZoom({ supabase, zoom }, { ...row })
      await asked('a')
      row.zoom_attempted_at = new Date(Date.now() - 31_000).toISOString()
      const b = registerWithZoom({ supabase, zoom }, { ...row })
      await asked('b')
      const runs = { a, b }
      const second = first === 'a' ? 'b' : 'a'
      answer[first]()
      await runs[first]
      answer[second]()
      return { row, second: await runs[second] }
    }

    it.each(['a', 'b'] as const)('same registration, %s first: nothing is cancelled', async (first) => {
      const { row, second } = await overlap({ a: 'r1', b: 'r1' }, first)
      expect(row).toMatchObject({ status: 'active', zoom_ref: 'r1' })
      expect(second).toMatchObject({ status: 'active' })
      expect(zoom.cancel).not.toHaveBeenCalled()
    })

    it.each([['a', 'r2'], ['b', 'r1']] as const)('different registrations, %s first: only %s is cancelled', async (first, spare) => {
      const { row, second } = await overlap({ a: 'r1', b: 'r2' }, first)
      expect(row).toMatchObject({ status: 'active' })
      expect(second).toBeNull()
      expect(zoom.cancel.mock.calls).toEqual([[{ eventId: 'e1', ref: spare }]])
    })
  })
})
