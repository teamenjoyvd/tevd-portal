import { describe, expect, it } from 'vitest'
import {
  findTreeRoots,
  checkSubmissionRoot,
  mergeSubmissions,
  type SubmissionInput,
} from '@/lib/csv-import'

// Minimal row helper — only the fields these pure fns read.
function row(abo: string, sponsor: string, extra: Record<string, string> = {}) {
  return { abo_number: abo, sponsor_abo_number: sponsor, name: `n${abo}`, ...extra }
}

describe('findTreeRoots', () => {
  it('returns the single node whose sponsor is outside the set', () => {
    const rows = [row('100', '999'), row('200', '100'), row('300', '200')]
    expect(findTreeRoots(rows)).toEqual(['100'])
  })

  it('treats an empty sponsor as a root', () => {
    const rows = [row('100', ''), row('200', '100')]
    expect(findTreeRoots(rows)).toEqual(['100'])
  })

  it('returns multiple roots for disconnected legs', () => {
    const rows = [row('100', '999'), row('200', '888'), row('201', '200')]
    expect(findTreeRoots(rows).sort()).toEqual(['100', '200'])
  })

  it('returns zero roots when every sponsor is in-set (cycle)', () => {
    const rows = [row('100', '200'), row('200', '100')]
    expect(findTreeRoots(rows)).toEqual([])
  })

  it('dedups repeated abo rows', () => {
    const rows = [row('100', '999'), row('100', '999')]
    expect(findTreeRoots(rows)).toEqual(['100'])
  })
})

describe('checkSubmissionRoot', () => {
  const rows = [row('100', '999'), row('200', '100')]

  it('ok when the single root matches the expected abo', () => {
    expect(checkSubmissionRoot(rows, '100')).toEqual({ ok: true, root: '100' })
  })

  it('mismatch when the single root is a different abo', () => {
    expect(checkSubmissionRoot(rows, '200')).toEqual({ ok: false, reason: 'mismatch', roots: ['100'] })
  })

  it('multi-root when there are several legs', () => {
    const multi = [row('100', '999'), row('200', '888')]
    expect(checkSubmissionRoot(multi, '100')).toEqual({ ok: false, reason: 'multi-root', roots: ['100', '200'] })
  })

  it('no-root when the set is cyclic', () => {
    const cyc = [row('100', '200'), row('200', '100')]
    expect(checkSubmissionRoot(cyc, '100')).toEqual({ ok: false, reason: 'no-root', roots: [] })
  })
})

describe('mergeSubmissions — deepest-owner-wins', () => {
  // Tree: 100 -> 200 -> 300. Senior owner 100 covers everyone; junior owner 200
  // covers 200,300. For the overlapping nodes the junior (deeper) owner wins.
  const senior: SubmissionInput = {
    rootAbo: '100',
    createdAt: '2026-01-01T00:00:00Z',
    rows: [
      row('100', '999', { bonus_percent: '3' }),
      row('200', '100', { bonus_percent: '3' }),
      row('300', '200', { bonus_percent: '3' }), // stale
    ],
  }
  const junior: SubmissionInput = {
    rootAbo: '200',
    createdAt: '2026-01-02T00:00:00Z',
    rows: [
      row('200', '100', { bonus_percent: '6' }),
      row('300', '200', { bonus_percent: '9' }), // fresh — should win
    ],
  }

  it('deeper owner (junior) wins overlapping nodes', () => {
    const res = mergeSubmissions([senior, junior])
    const byAbo = Object.fromEntries(res.rows.map(r => [r.abo_number, r]))
    expect(byAbo['300'].bonus_percent).toBe('9')
    expect(byAbo['200'].bonus_percent).toBe('6')
    // 100 only exists in the senior submission — kept.
    expect(byAbo['100'].bonus_percent).toBe('3')
    expect(res.total_row_count).toBe(3)
    // updated_by_abo = the owner (submission root) that won each node.
    expect(byAbo['300'].updated_by_abo).toBe('200') // junior/upline-of-300 won
    expect(byAbo['200'].updated_by_abo).toBe('200')
    expect(byAbo['100'].updated_by_abo).toBe('100') // only senior had it
  })

  it('order-independent — same winner regardless of submission order', () => {
    const a = mergeSubmissions([senior, junior])
    const b = mergeSubmissions([junior, senior])
    const pick = (r: typeof a) => Object.fromEntries(r.rows.map(x => [x.abo_number, x.bonus_percent]))
    expect(pick(a)).toEqual(pick(b))
  })

  it('flags overlapping nodes as junctions with their owners', () => {
    const res = mergeSubmissions([senior, junior])
    const j = res.junctions.find(x => x.abo_number === '300')
    expect(j).toBeTruthy()
    expect(j!.files.sort()).toEqual(['100', '200'])
  })

  it('ties on depth break by newest createdAt', () => {
    // Two sibling owners at the same depth both claim node 300.
    const older: SubmissionInput = { rootAbo: '100', createdAt: '2026-01-01T00:00:00Z', rows: [row('100', ''), row('300', '100', { bonus_percent: '1' })] }
    const newer: SubmissionInput = { rootAbo: '100', createdAt: '2026-02-01T00:00:00Z', rows: [row('100', ''), row('300', '100', { bonus_percent: '2' })] }
    const res = mergeSubmissions([older, newer])
    const byAbo = Object.fromEntries(res.rows.map(r => [r.abo_number, r]))
    expect(byAbo['300'].bonus_percent).toBe('2')
  })

  it('detects a fully disconnected submission', () => {
    const s1: SubmissionInput = { rootAbo: '100', createdAt: '2026-01-01T00:00:00Z', rows: [row('100', ''), row('200', '100')] }
    const s2: SubmissionInput = { rootAbo: '500', createdAt: '2026-01-01T00:00:00Z', rows: [row('500', ''), row('600', '500')] }
    const res = mergeSubmissions([s1, s2])
    expect(res.disconnected_files.sort()).toEqual(['100', '500'])
  })
})
