import { describe, expect, it } from 'vitest'
import { assertOwnProofPath, payerOf, redactForeignProofUrls } from './proof'

const ME = '11111111-1111-1111-1111-111111111111'
const ALICE = '22222222-2222-2222-2222-222222222222'

describe('payerOf', () => {
  it('names the explicit payer on a group row', () => {
    expect(payerOf({ profile_id: ME, paid_by_profile_id: ALICE })).toBe(ALICE)
  })

  it('falls back to the row owner on a legacy/self-paid row', () => {
    expect(payerOf({ profile_id: ME, paid_by_profile_id: null })).toBe(ME)
  })

  it('returns null when neither column was selected, so callers fail closed', () => {
    expect(payerOf({ proof_url: 'x/y.png' })).toBeNull()
  })
})

describe('assertOwnProofPath', () => {
  it('accepts a path under the caller own prefix', () => {
    const res = assertOwnProofPath(`${ME}/abc.png`, ME)
    expect(res).toEqual({ ok: true, value: `${ME}/abc.png` })
  })

  it('treats an absent proof as legitimately null — proof is optional', () => {
    expect(assertOwnProofPath(undefined, ME)).toEqual({ ok: true, value: null })
    expect(assertOwnProofPath(null, ME)).toEqual({ ok: true, value: null })
    expect(assertOwnProofPath('', ME)).toEqual({ ok: true, value: null })
  })

  it('rejects another profile object path — the core of the fix', () => {
    const res = assertOwnProofPath(`${ALICE}/secret.jpg`, ME)
    expect(res.ok).toBe(false)
  })

  it('rejects traversal even under a matching prefix', () => {
    const res = assertOwnProofPath(`${ME}/../${ALICE}/secret.jpg`, ME)
    expect(res.ok).toBe(false)
  })

  it('rejects a prefix that merely starts with the caller id', () => {
    // `${ME}extra/` shares a leading substring but is a different folder; the
    // trailing slash in the comparison is what makes this fail.
    const res = assertOwnProofPath(`${ME}extra/secret.jpg`, ME)
    expect(res.ok).toBe(false)
  })

  it('rejects a non-string proof_url', () => {
    expect(assertOwnProofPath({ toString: () => `${ME}/x.png` }, ME).ok).toBe(false)
    expect(assertOwnProofPath(42, ME).ok).toBe(false)
  })
})

describe('redactForeignProofUrls', () => {
  it('keeps the proof on rows the viewer paid for', () => {
    const rows = [
      { id: 'a', proof_url: `${ME}/a.png`, profile_id: ME, paid_by_profile_id: null },
      { id: 'b', proof_url: `${ME}/a.png`, profile_id: ALICE, paid_by_profile_id: ME },
    ]
    expect(redactForeignProofUrls(rows, ME).map((r) => r.proof_url)).toEqual([
      `${ME}/a.png`,
      `${ME}/a.png`,
    ])
  })

  it('nulls the proof on a group row the viewer merely benefits from', () => {
    const rows = [{ id: 'b', proof_url: `${ALICE}/bank.jpg`, profile_id: ME, paid_by_profile_id: ALICE }]
    expect(redactForeignProofUrls(rows, ME)[0]!.proof_url).toBeNull()
  })

  it('does not mutate the input rows', () => {
    const rows = [{ proof_url: `${ALICE}/bank.jpg`, profile_id: ME, paid_by_profile_id: ALICE }]
    redactForeignProofUrls(rows, ME)
    expect(rows[0]!.proof_url).toBe(`${ALICE}/bank.jpg`)
  })

  it('fails closed when the payer columns were not selected', () => {
    const rows = [{ proof_url: `${ALICE}/bank.jpg` }]
    expect(redactForeignProofUrls(rows, ME)[0]!.proof_url).toBeNull()
  })

  it('leaves rows alone when proof_url was not selected at all', () => {
    const rows = [{ id: 'a', profile_id: ALICE, paid_by_profile_id: ALICE }]
    expect(redactForeignProofUrls(rows, ME)).toEqual(rows)
  })
})
