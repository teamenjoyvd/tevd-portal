/**
 * What a person has actually paid towards their OWN fee (2607-DEV-677).
 *
 * Ad-hoc guests have no ledger, so their payment rows sit on the payer's
 * `profile_id` with `beneficiary_guest_id` set. Every query that computes a
 * PERSONAL total must therefore exclude them — otherwise a payer who covered
 * themselves 100 € and a friend 100 € is told they have paid 200 € of their own
 * 100 € fee: balance zero, progress bar full, 100 € still owed. That miscount is
 * the reason 2607-DEV-677 exists as its own issue.
 *
 * Kept in one place because there are two callers holding the same prop —
 * AttendeeView and ArchivedView — and a correction applied to one of them is
 * indistinguishable, at a glance, from a correction applied to both.
 */

export type PersonalTotalRow = {
  admin_status: string
  amount: number
  beneficiary_guest_id?: string | null
}

/**
 * Sums the approved rows that are the viewer's own fee. Rows must already be
 * scoped to one person's ledger — this function corrects for guests, not for
 * whose rows they are.
 *
 * `== null` catches both null and undefined: the trip page selects the column,
 * but a caller that forgot to would otherwise silently count guest money.
 */
export function personalApprovedTotal(rows: readonly PersonalTotalRow[]): number {
  return rows
    .filter((row) => row.admin_status === 'approved' && row.beneficiary_guest_id == null)
    .reduce((sum, row) => sum + row.amount, 0)
}
