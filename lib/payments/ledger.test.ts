import { describe, expect, it } from 'vitest'
import {
  beneficiaryNames,
  currencyOf,
  ledgerEntries,
  lifetimeTotals,
  payerName,
  toLedgerCSV,
  type LedgerRow,
} from './ledger'

/**
 * The L-numbers are the verification matrix from 2608-DEV-688. Each test names
 * the one it discharges so a failure points at the requirement, not just at a
 * line of code.
 */

const ME = 'prf_me'
const FRIEND = 'prf_friend'

/** A plain approved self-payment. Override only what a case is about. */
function row(over: Partial<LedgerRow> = {}): LedgerRow {
  return {
    id: 'pay_1',
    amount: 100,
    transaction_date: '2026-07-01',
    admin_status: 'approved',
    payment_method: 'bank_transfer',
    note: null,
    admin_note: null,
    currency: 'EUR',
    profile_id: ME,
    paid_by_profile_id: null,
    payment_group_id: null,
    beneficiary_guest_id: null,
    beneficiary: { first_name: 'Me', last_name: 'Myself' },
    payer: null,
    payment_guests: null,
    payable_items: { title: 'Membership 2026', item_type: 'membership', currency: 'EUR' },
    trips: null,
    ...over,
  }
}

/** The three sibling rows of one transfer: me, a friend, and an ad-hoc guest. */
function groupOfThree(): LedgerRow[] {
  return [
    row({ id: 'p_me', payment_group_id: 'grp_1', paid_by_profile_id: ME, amount: 100 }),
    row({
      id: 'p_friend',
      payment_group_id: 'grp_1',
      profile_id: FRIEND,
      paid_by_profile_id: ME,
      amount: 80,
      beneficiary: { first_name: 'Ana', last_name: 'Petrova' },
    }),
    row({
      id: 'p_guest',
      payment_group_id: 'grp_1',
      paid_by_profile_id: ME,
      amount: 60,
      beneficiary_guest_id: 'gst_1',
      payment_guests: { name: 'Nadia' },
    }),
  ]
}

describe('currencyOf', () => {
  it('L5: a trip payment with no payable_item reports its own currency, not EUR', () => {
    // The whole reason this helper exists. A trip payment has payable_items
    // === null, so the old `payable_items?.currency ?? "EUR"` read labelled a
    // USD charge as EUR.
    const trip = row({
      currency: 'USD',
      payable_items: null,
      trips: { title: 'Achievers Cancún' },
    })

    expect(currencyOf(trip)).toBe('USD')
  })

  it('falls back to the payable item when the row column was not selected', () => {
    const legacy = row({ currency: undefined, payable_items: { title: 'x', item_type: 'fee', currency: 'BGN' } })

    expect(currencyOf(legacy)).toBe('BGN')
  })

  it('falls back to EUR only when neither source carries a currency', () => {
    expect(currencyOf(row({ currency: undefined, payable_items: null }))).toBe('EUR')
  })
})

describe('ledgerEntries', () => {
  it('L1: a 3-row approved group I paid collapses to one entry with the summed amount', () => {
    const entries = ledgerEntries(groupOfThree(), ME)

    expect(entries).toHaveLength(1)
    expect(entries[0].key).toBe('g:grp_1')
    expect(entries[0].isGroup).toBe(true)
    expect(entries[0].amount).toBe(240)
    expect(entries[0].rows.map(r => r.id)).toEqual(['p_me', 'p_friend', 'p_guest'])
  })

  it('L2: the payer own row inside that group is not emitted twice', () => {
    const rows = groupOfThree()
    const entries = ledgerEntries(rows, ME)

    // Entries partition the input: every raw row appears in exactly one entry.
    const emitted = entries.flatMap(e => e.rows.map(r => r.id))
    expect(emitted).toHaveLength(rows.length)
    expect(emitted.filter(id => id === 'p_me')).toHaveLength(1)
  })

  it('does not collapse a group for a beneficiary who did not pay it', () => {
    // Ana holds one row of grp_1. Collapsing for her would show a 240 total she
    // never transferred.
    const entries = ledgerEntries(groupOfThree(), FRIEND)

    expect(entries).toHaveLength(3)
    expect(entries.map(e => e.key)).toEqual(['p:p_me', 'p:p_friend', 'p:p_guest'])
    expect(entries.every(e => e.isGroup === false)).toBe(true)
  })

  it('leaves an ungrouped payment as its own entry', () => {
    const entries = ledgerEntries([row({ id: 'solo' })], ME)

    expect(entries).toHaveLength(1)
    expect(entries[0].key).toBe('p:solo')
    expect(entries[0].amount).toBe(100)
  })

  it('L6: a mixed-status group renders pending, never undefined', () => {
    const rows = groupOfThree()
    rows[1].admin_status = 'rejected'

    const [entry] = ledgerEntries(rows, ME)

    expect(entry.status).toBe('pending')
    // StatusBadge calls .toLowerCase() on this value; undefined throws.
    expect(entry.status).toBeTypeOf('string')
  })

  it('L6: a uniformly approved group keeps approved', () => {
    expect(ledgerEntries(groupOfThree(), ME)[0].status).toBe('approved')
  })

  it('surfaces an admin note that only exists on a later row of the group', () => {
    const rows = groupOfThree()
    rows[2].admin_note = 'Amount does not match the transfer'

    expect(ledgerEntries(rows, ME)[0].admin_note).toBe('Amount does not match the transfer')
  })

  it('keeps two separate groups separate and preserves input order', () => {
    const rows = [
      ...groupOfThree(),
      row({ id: 'p_other', payment_group_id: 'grp_2', paid_by_profile_id: ME, amount: 25 }),
    ]

    expect(ledgerEntries(rows, ME).map(e => e.key)).toEqual(['g:grp_1', 'g:grp_2'])
  })

  it('is empty on an empty ledger rather than throwing', () => {
    expect(ledgerEntries([], ME)).toEqual([])
  })
})

describe('beneficiaryNames / payerName', () => {
  it('L1: a group I paid names every beneficiary except my own share', () => {
    const [entry] = ledgerEntries(groupOfThree(), ME)

    expect(beneficiaryNames(entry, ME, 'guest')).toEqual(['Ana Petrova', 'Nadia (guest)'])
  })

  it('names nobody on an ordinary self-payment, so "for …" stays hidden', () => {
    const [entry] = ledgerEntries([row()], ME)

    expect(beneficiaryNames(entry, ME, 'guest')).toEqual([])
  })

  it('still names an ad-hoc guest on a single row that sits on my own ledger', () => {
    const [entry] = ledgerEntries(
      [row({ beneficiary_guest_id: 'gst_1', payment_guests: { name: 'Nadia' } })],
      ME,
    )

    expect(beneficiaryNames(entry, ME, 'guest')).toEqual(['Nadia (guest)'])
  })

  it('L3: a row on my ledger with a foreign payer reports that payer name', () => {
    const [entry] = ledgerEntries(
      [row({ paid_by_profile_id: FRIEND, payer: { first_name: 'Ivan', last_name: 'Dimov' } })],
      ME,
    )

    expect(payerName(entry, ME)).toBe('Ivan Dimov')
  })

  it('L3: reports null on a payment I made myself', () => {
    expect(payerName(ledgerEntries([row()], ME)[0], ME)).toBeNull()
  })

  it('L3: reports null rather than a placeholder when the payer embed is missing', () => {
    const [entry] = ledgerEntries([row({ paid_by_profile_id: FRIEND, payer: null })], ME)

    expect(payerName(entry, ME)).toBeNull()
  })
})

describe('lifetimeTotals', () => {
  it('L4: does not double-count the payer own share of a group they paid', () => {
    const totals = lifetimeTotals(groupOfThree(), ME)

    // 100 towards my own fee; 80 for Ana + 60 for the guest paid on their behalf.
    expect(totals.paid).toEqual({ EUR: 100 })
    expect(totals.onBehalf).toEqual({ EUR: 140 })
    expect(totals.paidForMe).toEqual({})
  })

  it('L4: counts a guest row as on-behalf despite it sitting on my own profile_id', () => {
    // payments_guest_ledger_check forces profile_id = paid_by_profile_id on a
    // guest row, so it looks like a self-payment. Counting it as "paid" is the
    // 2607-DEV-677 miscount.
    const guestOnly = [
      row({ id: 'g1', paid_by_profile_id: ME, beneficiary_guest_id: 'gst_1', amount: 60 }),
    ]

    const totals = lifetimeTotals(guestOnly, ME)

    expect(totals.paid).toEqual({})
    expect(totals.onBehalf).toEqual({ EUR: 60 })
  })

  it('L4: buckets per currency instead of summing across them', () => {
    const rows = [
      row({ id: 'a', amount: 100, currency: 'EUR' }),
      row({ id: 'b', amount: 40, currency: 'USD', payable_items: null, trips: { title: 'Cancún' } }),
    ]

    expect(lifetimeTotals(rows, ME).paid).toEqual({ EUR: 100, USD: 40 })
  })

  it('L4: money someone else paid for me lands in paidForMe, not in paid', () => {
    const rows = [
      row({ id: 'x', profile_id: ME, paid_by_profile_id: FRIEND, amount: 75 }),
    ]

    const totals = lifetimeTotals(rows, ME)

    expect(totals.paid).toEqual({})
    expect(totals.paidForMe).toEqual({ EUR: 75 })
  })

  it('counts approved rows only', () => {
    const rows = [
      row({ id: 'p', admin_status: 'pending', amount: 100 }),
      row({ id: 'r', admin_status: 'rejected', amount: 100 }),
      row({ id: 'a', admin_status: 'approved', amount: 10 }),
    ]

    expect(lifetimeTotals(rows, ME).paid).toEqual({ EUR: 10 })
  })

  it('is three empty buckets on an empty ledger rather than NaN', () => {
    expect(lifetimeTotals([], ME)).toEqual({ paid: {}, onBehalf: {}, paidForMe: {} })
  })
})

describe('toLedgerCSV', () => {
  it('L7: emits one line per RAW row, never per collapsed entry', () => {
    const csv = toLedgerCSV(groupOfThree())

    // 1 header + 3 data lines. A collapsed group would hide which share went to
    // whom, which is the point of exporting an on-behalf ledger.
    expect(csv.trimEnd().split('\r\n')).toHaveLength(4)
  })

  it('L7: never emits proof_url', () => {
    const csv = toLedgerCSV([row({ id: 'p', proof_url: `${ME}/abc.png` })])

    expect(csv).not.toContain('abc.png')
    expect(csv.toLowerCase()).not.toContain('proof')
  })

  it('L7: a note containing commas and quotes round-trips', () => {
    const csv = toLedgerCSV([row({ id: 'p', note: 'Paid 50, then 50; said "later"' })])
    const dataLine = csv.trimEnd().split('\r\n')[1]

    // RFC 4180: the comma stays inside the quoted field and each embedded quote
    // is doubled.
    expect(dataLine).toContain('"Paid 50, then 50; said ""later"""')
  })

  it('names the guest rather than the payer on a guest row', () => {
    const csv = toLedgerCSV(
      [row({ id: 'p', beneficiary_guest_id: 'gst_1', payment_guests: { name: 'Nadia' } })],
      'guest',
    )

    expect(csv).toContain('"Nadia (guest)"')
  })

  it('starts with a BOM and uses CRLF so Excel reads Cyrillic correctly', () => {
    const csv = toLedgerCSV([row()])

    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('emits a header-only file for an empty ledger', () => {
    expect(toLedgerCSV([]).trimEnd().split('\r\n')).toHaveLength(1)
  })
})
