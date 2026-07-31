/**
 * Integer-cent split maths for paying on behalf of others (2607-DEV-676).
 *
 * Every amount in this module is an integer number of cents. Floats never
 * touch the money: `240 / 3` in euros is 79.99999999999999, and three of those
 * do not add up to 240. The invariant the whole feature rests on is that the
 * beneficiary rows sum EXACTLY to the total — `submit_payment_group` re-asserts
 * it in SQL and rejects the submission otherwise.
 *
 * Editing one row locks it; the remainder is redistributed across the rows that
 * are still unlocked, so a user who types one person's share never silently
 * changes the total.
 */

export type SplitRow = {
  /** profiles.id of the beneficiary. */
  profileId: string
  /** This beneficiary's share, in integer cents. */
  amountCents: number
  /** True once the user has typed this row's amount by hand. */
  locked: boolean
}

/** Cents cannot exceed this; guards against a pasted absurdity overflowing later maths. */
const MAX_TOTAL_CENTS = 100_000_000 // 1,000,000.00

export class SplitError extends Error {}

function assertValidTotal(totalCents: number): void {
  if (!Number.isInteger(totalCents)) {
    throw new SplitError(`total must be an integer number of cents, got ${totalCents}`)
  }
  // Explicitly compared, not truthiness-checked: 0 is a real number that is
  // nonetheless not a payable total, and it must not be confused with "missing".
  if (totalCents <= 0) {
    throw new SplitError(`total must be greater than zero cents, got ${totalCents}`)
  }
  if (totalCents > MAX_TOTAL_CENTS) {
    throw new SplitError(`total exceeds the ${MAX_TOTAL_CENTS} cent ceiling, got ${totalCents}`)
  }
}

/**
 * Split `totalCents` across `count` people as evenly as integers allow.
 *
 * The base is floored and the remainder handed out one cent at a time from the
 * front, so 1000 cents across 3 people is [334, 333, 333] — never [333,333,333]
 * (30 cents short) and never a fractional cent.
 */
export function equalSplit(totalCents: number, count: number): number[] {
  assertValidTotal(totalCents)
  if (!Number.isInteger(count) || count <= 0) {
    throw new SplitError(`count must be a positive integer, got ${count}`)
  }
  if (count > totalCents) {
    throw new SplitError(`cannot split ${totalCents} cents across ${count} people — someone would get 0`)
  }

  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}

/** Sum of every row's share, in cents. */
export function sumCents(rows: readonly SplitRow[]): number {
  return rows.reduce((acc, row) => acc + (row.amountCents ?? 0), 0)
}

/** True when the rows add up to the total exactly — the submit precondition. */
export function isBalanced(rows: readonly SplitRow[], totalCents: number): boolean {
  return rows.length > 0 && sumCents(rows) === totalCents
}

/**
 * Redistribute `totalCents` across `rows`, honouring every locked row.
 *
 * Locked rows keep their amount. Whatever is left over is split evenly across
 * the unlocked rows by the same floor-plus-remainder rule.
 *
 * When the locked rows already claim the whole total (or more), the unlocked
 * rows are zeroed rather than driven negative — the caller surfaces that as an
 * unbalanced form, which `isBalanced` will reject.
 */
export function redistribute(rows: readonly SplitRow[], totalCents: number): SplitRow[] {
  assertValidTotal(totalCents)
  if (rows.length === 0) return []

  const unlockedCount = rows.filter((row) => !row.locked).length
  if (unlockedCount === 0) return rows.map((row) => ({ ...row }))

  const lockedTotal = rows.reduce((acc, row) => acc + (row.locked ? row.amountCents ?? 0 : 0), 0)
  const remaining = totalCents - lockedTotal

  // Over-committed: the locked rows alone meet or exceed the total. Zeroing is
  // the honest answer; inventing negative shares would let an unbalanced form
  // look balanced.
  if (remaining <= 0) {
    return rows.map((row) => (row.locked ? { ...row } : { ...row, amountCents: 0 }))
  }

  const base = Math.floor(remaining / unlockedCount)
  const extra = remaining - base * unlockedCount

  let seen = 0
  return rows.map((row) => {
    if (row.locked) return { ...row }
    const amountCents = base + (seen < extra ? 1 : 0)
    seen += 1
    return { ...row, amountCents }
  })
}

/**
 * Apply a hand-typed amount to one row: it locks, and every still-unlocked row
 * absorbs the difference. Editing back to the prefilled value still leaves the
 * row locked — the user touched it, so it stops moving under them.
 */
export function setRowAmount(
  rows: readonly SplitRow[],
  profileId: string,
  amountCents: number,
  totalCents: number,
): SplitRow[] {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new SplitError(`row amount must be a non-negative integer number of cents, got ${amountCents}`)
  }
  const next = rows.map((row) =>
    row.profileId === profileId ? { ...row, amountCents, locked: true } : { ...row },
  )
  return redistribute(next, totalCents)
}

/**
 * Build the initial rows for a set of beneficiaries: an equal split, nothing
 * locked. With a single beneficiary this is just the whole total, which is why
 * the flag-off form behaves exactly like today's single-payment form.
 */
export function initialSplit(profileIds: readonly string[], totalCents: number): SplitRow[] {
  const amounts = equalSplit(totalCents, profileIds.length)
  return profileIds.map((profileId, i) => ({
    profileId,
    amountCents: amounts[i],
    locked: false,
  }))
}
