import { describe, expect, it } from 'vitest'
import {
  SplitError,
  equalSplit,
  initialSplit,
  isBalanced,
  redistribute,
  setRowAmount,
  sumCents,
  type SplitRow,
} from '@/lib/payments/split'

const row = (profileId: string, amountCents: number, locked = false): SplitRow => ({
  profileId,
  amountCents,
  locked,
})

describe('equalSplit', () => {
  it('splits evenly when it divides', () => {
    expect(equalSplit(20000, 2)).toEqual([10000, 10000])
  })

  it('hands the remainder out one cent at a time from the front', () => {
    expect(equalSplit(1000, 3)).toEqual([334, 333, 333])
  })

  it('always sums to the total exactly — the whole point', () => {
    for (const total of [1, 7, 100, 999, 1000, 20000, 123457]) {
      for (const count of [1, 2, 3, 4, 7, 13]) {
        if (count > total) continue
        expect(sumCents(initialSplit(Array.from({ length: count }, (_, i) => `p${i}`), total))).toBe(total)
      }
    }
  })

  it('gives the single beneficiary the whole total', () => {
    expect(equalSplit(24000, 1)).toEqual([24000])
  })

  it('rejects a zero total rather than treating it as missing', () => {
    expect(() => equalSplit(0, 2)).toThrow(SplitError)
  })

  it('rejects a negative total', () => {
    expect(() => equalSplit(-100, 2)).toThrow(SplitError)
  })

  it('rejects a fractional cent total', () => {
    expect(() => equalSplit(100.5, 2)).toThrow(SplitError)
  })

  it('rejects a count that would leave someone on 0', () => {
    expect(() => equalSplit(2, 3)).toThrow(SplitError)
  })

  it('rejects a zero count', () => {
    expect(() => equalSplit(1000, 0)).toThrow(SplitError)
  })
})

describe('redistribute', () => {
  it('spreads the total across unlocked rows', () => {
    const out = redistribute([row('a', 0), row('b', 0)], 20000)
    expect(out.map((r) => r.amountCents)).toEqual([10000, 10000])
  })

  it('leaves locked rows alone and rebalances the rest', () => {
    const out = redistribute([row('a', 15000, true), row('b', 0), row('c', 0)], 24000)
    expect(out.map((r) => r.amountCents)).toEqual([15000, 4500, 4500])
    expect(sumCents(out)).toBe(24000)
  })

  it('gives the odd cent to the first unlocked row', () => {
    const out = redistribute([row('a', 1, true), row('b', 0), row('c', 0)], 1000)
    expect(out.map((r) => r.amountCents)).toEqual([1, 500, 499])
    expect(sumCents(out)).toBe(1000)
  })

  it('returns locked rows untouched when nothing is unlocked', () => {
    const rows = [row('a', 100, true), row('b', 900, true)]
    expect(redistribute(rows, 20000).map((r) => r.amountCents)).toEqual([100, 900])
  })

  it('zeroes unlocked rows rather than going negative when locks exceed the total', () => {
    const out = redistribute([row('a', 30000, true), row('b', 5000)], 24000)
    expect(out.map((r) => r.amountCents)).toEqual([30000, 0])
    expect(isBalanced(out, 24000)).toBe(false)
  })

  it('zeroes unlocked rows when the locks exactly meet the total', () => {
    const out = redistribute([row('a', 24000, true), row('b', 1)], 24000)
    expect(out.map((r) => r.amountCents)).toEqual([24000, 0])
  })

  it('does not mutate the input rows', () => {
    const rows = [row('a', 0), row('b', 0)]
    redistribute(rows, 20000)
    expect(rows.map((r) => r.amountCents)).toEqual([0, 0])
  })

  it('returns an empty array for no rows', () => {
    expect(redistribute([], 20000)).toEqual([])
  })
})

describe('setRowAmount', () => {
  it('locks the edited row and rebalances the others', () => {
    const out = setRowAmount(initialSplit(['a', 'b', 'c'], 30000), 'b', 12000, 30000)
    expect(out.find((r) => r.profileId === 'b')).toEqual({ profileId: 'b', amountCents: 12000, locked: true })
    expect(sumCents(out)).toBe(30000)
  })

  it('keeps the row locked even when typed back to the prefilled value', () => {
    const out = setRowAmount(initialSplit(['a', 'b'], 20000), 'a', 10000, 20000)
    expect(out.find((r) => r.profileId === 'a')?.locked).toBe(true)
  })

  it('accepts 0 as a typed amount — it is data, and isBalanced is what rejects the form', () => {
    const out = setRowAmount(initialSplit(['a', 'b'], 20000), 'a', 0, 20000)
    expect(out.map((r) => r.amountCents)).toEqual([0, 20000])
    expect(isBalanced(out, 20000)).toBe(true)
  })

  it('rejects a negative typed amount', () => {
    expect(() => setRowAmount(initialSplit(['a', 'b'], 20000), 'a', -1, 20000)).toThrow(SplitError)
  })

  it('rejects a fractional typed amount', () => {
    expect(() => setRowAmount(initialSplit(['a', 'b'], 20000), 'a', 10.5, 20000)).toThrow(SplitError)
  })

  it('leaves earlier locks in place when a second row is edited', () => {
    const once = setRowAmount(initialSplit(['a', 'b', 'c'], 30000), 'a', 5000, 30000)
    const twice = setRowAmount(once, 'b', 5000, 30000)
    expect(twice.map((r) => r.amountCents)).toEqual([5000, 5000, 20000])
    expect(twice.map((r) => r.locked)).toEqual([true, true, false])
    expect(sumCents(twice)).toBe(30000)
  })
})

describe('isBalanced', () => {
  it('is true only on an exact match', () => {
    expect(isBalanced([row('a', 10000), row('b', 10000)], 20000)).toBe(true)
    expect(isBalanced([row('a', 10000), row('b', 9999)], 20000)).toBe(false)
    expect(isBalanced([row('a', 10000), row('b', 10001)], 20000)).toBe(false)
  })

  it('is false with no rows at all', () => {
    expect(isBalanced([], 0)).toBe(false)
  })
})

describe('initialSplit', () => {
  it('prefills an equal split with nothing locked', () => {
    expect(initialSplit(['a', 'b'], 20000)).toEqual([
      { profileId: 'a', amountCents: 10000, locked: false },
      { profileId: 'b', amountCents: 10000, locked: false },
    ])
  })

  it('behaves like the legacy single payment for one beneficiary', () => {
    expect(initialSplit(['a'], 24000)).toEqual([{ profileId: 'a', amountCents: 24000, locked: false }])
  })
})
