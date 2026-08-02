/**
 * Who a payment row was FOR, as display text (2607-DEV-677).
 *
 * An ad-hoc guest has no `profiles` row, so their payment sits on the PAYER's
 * `profile_id` — which means the `profiles!profile_id` embed every payment
 * surface calls `beneficiary` resolves to the payer, not to the person the
 * money was for. Reading it directly prints the payer's own name once per
 * guest. `payment_guests` must therefore win wherever a row is named.
 *
 * Extracted rather than inlined for the same reason as `personalApprovedTotal`
 * next door: the choice has three branches and two callers, and a correction
 * applied to one caller is indistinguishable, at a glance, from one applied to
 * both. Keeping it in a .ts module also puts it under the existing vitest
 * runner — the repo has no jsdom/testing-library setup, so a helper is the only
 * part of this render that can be verified by a test at all.
 */

export type BeneficiaryRow = {
  beneficiary?: { first_name: string; last_name: string } | null
  payment_guests?: { name: string } | null
}

/**
 * `<name> (<tag>)` when the row was paid for an ad-hoc guest, else null.
 *
 * `guestTag` is passed in rather than read here: this module is framework-free
 * and the label is translated (`payment.guestTag`), so the caller supplies it
 * from its own `t()`.
 */
export function guestLabel(row: BeneficiaryRow, guestTag: string): string | null {
  const name = row.payment_guests?.name
  // Explicit null/undefined test, not truthiness: a name is user-typed text and
  // the DB CHECK only forbids blank AFTER trimming, so treat any present value
  // as a guest and let it render as-is rather than silently falling through to
  // the payer's name — which is the exact bug this module exists to prevent.
  if (name == null) return null
  return `${name} (${guestTag})`
}

/**
 * The name to show for a row's beneficiary: the guest if there is one, else the
 * profile the row sits on, else an em dash when neither was selected by the
 * query (a forgotten embed must not render "undefined undefined").
 */
export function beneficiaryLabel(row: BeneficiaryRow, guestTag: string): string {
  const guest = guestLabel(row, guestTag)
  if (guest !== null) return guest
  const profile = row.beneficiary
  if (profile == null) return '—'
  return `${profile.first_name} ${profile.last_name}`
}
