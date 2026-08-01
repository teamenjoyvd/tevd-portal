import { describe, expect, it } from 'vitest'
import { personalApprovedTotal, type PersonalTotalRow } from './totals'

/**
 * G3 from 2607-DEV-677 — the regression this issue exists to prevent. Asserted
 * on the arithmetic rather than on a rendered progress bar: the percentage is a
 * fragile assertion and the miscount is the actual defect.
 */
describe('personalApprovedTotal', () => {
  it('G3: excludes an approved guest row from the payer own total', () => {
    const rows: PersonalTotalRow[] = [
      { admin_status: 'approved', amount: 100, beneficiary_guest_id: null },
      { admin_status: 'approved', amount: 100, beneficiary_guest_id: 'gst_1' },
    ]

    // Both rows sit on the payer's ledger and both are real money they paid.
    // Only the first is money towards their OWN fee.
    expect(personalApprovedTotal(rows)).toBe(100)
  })

  it('G3: a trip covered for guests only leaves the payer own balance untouched', () => {
    const rows: PersonalTotalRow[] = [
      { admin_status: 'approved', amount: 100, beneficiary_guest_id: 'gst_1' },
      { admin_status: 'approved', amount: 100, beneficiary_guest_id: 'gst_2' },
    ]

    expect(personalApprovedTotal(rows)).toBe(0)
  })

  it('counts a plain self-payment, the pre-677 behaviour', () => {
    const rows: PersonalTotalRow[] = [
      { admin_status: 'approved', amount: 60, beneficiary_guest_id: null },
      { admin_status: 'approved', amount: 40, beneficiary_guest_id: null },
    ]

    expect(personalApprovedTotal(rows)).toBe(100)
  })

  it('still excludes pending rows, guest or not', () => {
    const rows: PersonalTotalRow[] = [
      { admin_status: 'pending', amount: 100, beneficiary_guest_id: null },
      { admin_status: 'pending', amount: 100, beneficiary_guest_id: 'gst_1' },
      { admin_status: 'rejected', amount: 100, beneficiary_guest_id: null },
    ]

    expect(personalApprovedTotal(rows)).toBe(0)
  })

  it('treats a row with the column absent as the caller own, not as a guest', () => {
    // A row shape that predates the column — an omitted key must not be read as
    // "guest" and silently dropped from someone's balance.
    const rows: PersonalTotalRow[] = [{ admin_status: 'approved', amount: 100 }]

    expect(personalApprovedTotal(rows)).toBe(100)
  })

  it('is 0 on an empty ledger rather than NaN', () => {
    expect(personalApprovedTotal([])).toBe(0)
  })
})
