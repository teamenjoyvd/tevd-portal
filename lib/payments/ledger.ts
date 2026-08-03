/**
 * The member-facing payment ledger (2608-DEV-688).
 *
 * Three things happen to a payment row between the database and the profile
 * bento, and each of them used to lose information:
 *
 *   1. CURRENCY. `payments.currency` is selected by GET /api/payments but was
 *      never declared on the client type, so every reader fell back to
 *      `payable_items?.currency ?? 'EUR'` — and a TRIP payment has no
 *      payable_item at all, which force-labelled every trip payment EUR
 *      regardless of what was actually charged. `currencyOf` is the single
 *      read; nothing else may reach for the currency directly.
 *
 *   2. GROUPING. One bank transfer paid on behalf of N people is N sibling rows
 *      sharing a `payment_group_id`. The old key was the item/trip TITLE, which
 *      both split one transfer across items and merged unrelated transfers of
 *      the same item. `ledgerEntries` keys on the group instead — but only for
 *      the payer, because a beneficiary sees exactly one row of that group and
 *      must not be shown a collapsed total they did not pay.
 *
 *   3. TOTALS. An ad-hoc guest (2607-DEV-677) has no ledger of their own, so a
 *      guest row sits on the PAYER's `profile_id` and looks indistinguishable
 *      from money the payer paid towards their own fee. `lifetimeTotals` splits
 *      on that explicitly; it is the highest-risk arithmetic in this module.
 *
 * Framework-free on purpose, like `labels.ts` and `totals.ts` next door: the
 * repo has no jsdom/testing-library setup, so a plain .ts helper is the only
 * part of this feature a unit test can reach at all.
 *
 * Money note: amounts are JS numbers because that is what PostgREST returns for
 * `numeric` and what `formatCurrency` consumes — the same representation
 * `personalApprovedTotal` already sums. This module does not introduce minor
 * units; it only adds, never multiplies or divides, so no new rounding error is
 * created here.
 */

import { payerOf } from './proof'
import { beneficiaryLabel } from './labels'
// The repo's one RFC-4180 field quoter. Reused rather than re-implemented so a
// correction to the escaping rule cannot land in only one of two exports.
import { csvQuote, csvSafe } from '../csv-export'

/**
 * The columns this module reads. Declared structurally rather than importing
 * `GenericPayment` from app/: lib/ must not depend on a route's view model, and
 * every field is optional for the same reason `ProofRow`'s are — a narrower
 * caller that forgot a column must fail closed, not throw.
 */
export type LedgerRow = {
  id: string
  amount: number
  transaction_date: string
  admin_status: string
  payment_method?: string | null
  note?: string | null
  admin_note?: string | null
  currency?: string | null
  /** Present on the rows callers hand in, read by nothing here, and pointedly
   *  absent from the CSV — see `toLedgerCSV`. */
  proof_url?: string | null
  profile_id?: string | null
  paid_by_profile_id?: string | null
  payment_group_id?: string | null
  beneficiary_guest_id?: string | null
  beneficiary?: { first_name: string; last_name: string } | null
  payer?: { first_name: string; last_name: string } | null
  payment_guests?: { name: string } | null
  payable_items?: { title: string; item_type: string; currency: string } | null
  trips?: { title: string } | null
}

/** One line in the ledger: either a single payment or one collapsed group. */
export type LedgerEntry = {
  /** `g:${payment_group_id}:${currency}` for a collapsed group, `p:${row.id}`
   *  otherwise. Currency is in the key because the total sums the bucket. */
  key: string
  /** Every raw row this entry stands for, in input order. Never empty. */
  rows: LedgerRow[]
  isGroup: boolean
  /** Summed across `rows` — for a single entry, that row's amount. */
  amount: number
  currency: string
  /** Uniform status when the group agrees, else 'pending'. Never undefined. */
  status: string
  transaction_date: string
  /** Payable item or trip title; '' when the row carries neither. */
  title: string
  payment_method: string | null
  admin_note: string | null
}

/** Per-currency sums. Keyed by ISO currency code, e.g. `{ EUR: 250, USD: 40 }`. */
export type CurrencyTotals = Record<string, number>

export type LifetimeTotals = {
  /** Approved money towards the viewer's OWN fee. */
  paid: CurrencyTotals
  /** Approved money the viewer paid for other people, guests included. */
  onBehalf: CurrencyTotals
  /** Approved money someone else paid towards the viewer's fee. */
  paidForMe: CurrencyTotals
}

/**
 * The currency a row is denominated in.
 *
 * `??` not `||`: an empty string is not a currency but it is also not a value
 * PostgREST produces for a `text NOT NULL DEFAULT 'EUR'` column, and swallowing
 * it silently would hide a data bug behind a plausible-looking 'EUR'.
 */
export function currencyOf(row: LedgerRow): string {
  return row.currency ?? row.payable_items?.currency ?? 'EUR'
}

/** The item this row was for, as display text; '' when it names neither. */
export function titleOf(row: LedgerRow): string {
  return row.payable_items?.title ?? row.trips?.title ?? ''
}

/**
 * Collapses the viewer's own on-behalf groups to one entry each and leaves
 * everything else alone.
 *
 * A group is ONE bank transfer. Rendering it as N rows was the original lie
 * this issue exists to correct — but only from the payer's side: a beneficiary
 * holds a single row of that group and, for them, one row is the truth.
 *
 * Every input row is emitted in exactly one entry (L2): entries partition the
 * input, so the payer's own share inside a group they paid is folded into the
 * group total rather than also standing alone.
 *
 * Order is first-appearance order of each entry's first row, so a caller that
 * sorted its rows before calling keeps that sort.
 */
export function ledgerEntries(rows: readonly LedgerRow[], me: string): LedgerEntry[] {
  const order: string[] = []
  const buckets = new Map<string, LedgerRow[]>()

  for (const row of rows) {
    // Collapse only when BOTH hold: the row belongs to a group, and the viewer
    // is the one who transferred the money. Anything else is its own entry.
    const collapse = row.payment_group_id != null && payerOf(row) === me
    // Currency is part of the key, not just of the head row: `amount` sums the
    // whole bucket while `currency` reports one code, so a group holding two
    // denominations would render a single total in the head's currency and
    // formatCurrency would give that wrong number a plausible symbol.
    // submit_payment_group writes one currency per group today; keying on it
    // means this stays arithmetic rather than an assumption.
    const key = collapse ? `g:${row.payment_group_id}:${currencyOf(row)}` : `p:${row.id}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(row)
    } else {
      buckets.set(key, [row])
      order.push(key)
    }
  }

  return order.map((key) => {
    const entryRows = buckets.get(key)!
    const head = entryRows[0]
    const statuses = new Set(entryRows.map((r) => r.admin_status))
    return {
      key,
      rows: entryRows,
      isGroup: entryRows.length > 1,
      amount: entryRows.reduce((sum, r) => sum + Number(r.amount), 0),
      currency: currencyOf(head),
      // A mixed group is not yet resolved, so it reads as pending. NEVER
      // undefined: StatusBadge calls .toLowerCase() on this and would throw
      // (the crash fixed by 21558be).
      status: statuses.size === 1 ? head.admin_status : 'pending',
      transaction_date: head.transaction_date,
      title: titleOf(head),
      payment_method: head.payment_method ?? null,
      // Surfaced from the first row that carries one: an admin note explains a
      // rejection, and a group whose note only lives on row 3 would otherwise
      // render as an unexplained refusal.
      admin_note: entryRows.find((r) => r.admin_note != null)?.admin_note ?? null,
    }
  })
}

/**
 * The people this entry was paid FOR, excluding the viewer's own share.
 *
 * A guest row is included even though it sits on the viewer's `profile_id` —
 * that placement is a storage detail (`payments_guest_ledger_check`), not a
 * statement about who the money was for.
 *
 * Empty for an ordinary self-payment, which is what makes `for …` render only
 * when it says something.
 */
export function beneficiaryNames(entry: LedgerEntry, me: string, guestTag: string): string[] {
  return entry.rows
    .filter((r) => r.beneficiary_guest_id != null || r.profile_id !== me)
    .map((r) => beneficiaryLabel(r, guestTag))
}

/**
 * The name of whoever paid this entry when it was NOT the viewer, else null.
 *
 * Null rather than a placeholder when the `payer` embed is missing: a query
 * that forgot the hint should render nothing, not "Paid by —", which reads like
 * a data loss the member is expected to act on.
 */
export function payerName(entry: LedgerEntry, me: string): string | null {
  const head = entry.rows[0]
  if (payerOf(head) === me) return null
  const p = head.payer
  if (p == null) return null
  return `${p.first_name} ${p.last_name}`
}

function addTo(bucket: CurrencyTotals, row: LedgerRow): void {
  const currency = currencyOf(row)
  bucket[currency] = (bucket[currency] ?? 0) + Number(row.amount)
}

/**
 * Lifetime approved totals, reduced over RAW rows.
 *
 * Reducing over `ledgerEntries` instead would double-count: a payer who
 * included themselves in a group of three sees one entry worth all three
 * shares, and their own share is simultaneously their own fee and part of the
 * transfer. Raw rows have no such overlap — every row lands in exactly one
 * bucket.
 *
 * The guest case is the subtle one. `payments_guest_ledger_check` forces a
 * guest row to satisfy `profile_id = paid_by_profile_id`, so it LOOKS like the
 * payer paying themselves. It is money paid for somebody else and belongs in
 * `onBehalf`; counting it in `paid` is exactly the miscount 2607-DEV-677 was
 * filed for.
 *
 * Approved only, matching `personalApprovedTotal` — pending money has not moved
 * as far as the club is concerned, and rejected money never will.
 */
export function lifetimeTotals(rows: readonly LedgerRow[], me: string): LifetimeTotals {
  const totals: LifetimeTotals = { paid: {}, onBehalf: {}, paidForMe: {} }

  for (const row of rows) {
    if (row.admin_status !== 'approved') continue

    const payer = payerOf(row)
    const isMine = row.profile_id === me
    // == null covers both null and undefined: a caller that failed to select
    // the column must not have guest money counted as the viewer's own.
    const isForGuest = row.beneficiary_guest_id != null

    if (payer === me) {
      // TRUE when the row sits on my ledger AND names no guest — the only
      // shape that is money towards my own fee.
      if (isMine && !isForGuest) addTo(totals.paid, row)
      else addTo(totals.onBehalf, row)
    } else if (isMine) {
      addTo(totals.paidForMe, row)
    }
    // Neither payer nor owner: not the viewer's money in either direction.
    // GET /api/payments does not return such rows today; ignoring them keeps
    // the reduce correct if it ever does.
  }

  return totals
}

// ── CSV export ────────────────────────────────────────────────────────────────

/** U+FEFF byte-order mark, constructed rather than pasted so this source file
 *  does not itself contain a stray BOM in the middle of a line. */
const BOM = String.fromCharCode(0xfeff)

const CSV_HEADERS = [
  'Date',
  'Amount',
  'Currency',
  'Status',
  'Method',
  'Item',
  'Paid for',
  'Paid by',
  'Note',
] as const

/**
 * One line per RAW payment row — never per collapsed entry.
 *
 * An export is an audit artifact: the reader wants the rows as recorded, and a
 * collapsed group would hide which share went to whom, which is the entire
 * point of exporting an on-behalf ledger.
 *
 * `proof_url` is deliberately absent. It is a key into a private bucket, not a
 * URL (see proof.ts), and a column of unusable storage paths in a spreadsheet
 * is worse than no column: it invites someone to paste one into a browser and
 * conclude the proof is gone.
 *
 * `guestTag` is a parameter for the same reason `beneficiaryLabel`'s is: this
 * module is framework-free and the tag is translated by the caller. The default
 * keeps the helper usable from a test without a translation table.
 */
export function toLedgerCSV(rows: readonly LedgerRow[], guestTag = 'guest'): string {
  const lines: string[] = [CSV_HEADERS.map(csvQuote).join(',')]

  for (const row of rows) {
    lines.push(
      [
        row.transaction_date,
        // Not toFixed(): the amount is written for a spreadsheet, and a locale
        // that reads '.' as a thousands separator is a formatting concern of
        // the file's reader, not something a fixed decimal count fixes.
        //
        // NOT csvSafe'd, unlike the text columns below: a negative amount opens
        // with '-', and prefixing it would demote a numeric cell to text — the
        // one place the guard would do harm. The value is a JS number rendered
        // by String(), so it cannot carry a formula in the first place.
        String(row.amount),
        currencyOf(row),
        row.admin_status,
        // Everything from here down is free text a member or admin typed, or a
        // name they chose, so each is a formula-injection vector on its own.
        csvSafe(row.payment_method ?? ''),
        csvSafe(titleOf(row)),
        csvSafe(beneficiaryLabel(row, guestTag)),
        csvSafe(row.payer ? `${row.payer.first_name} ${row.payer.last_name}` : ''),
        csvSafe(row.note ?? ''),
      ]
        .map(csvQuote)
        .join(','),
    )
  }

  // BOM + CRLF, matching buildMembersCSV: without the BOM, Excel renders
  // Cyrillic names as mojibake.
  return BOM + lines.join('\r\n') + '\r\n'
}
