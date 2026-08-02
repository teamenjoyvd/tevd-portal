import { describe, it, expect } from 'vitest'
import { beneficiaryLabel, guestLabel } from './labels'

const PAYER = { first_name: 'Ivan', last_name: 'Petrov' }

describe('guestLabel', () => {
  it('names the guest and tags them', () => {
    expect(guestLabel({ payment_guests: { name: 'Nadia' } }, 'guest')).toBe('Nadia (guest)')
  })

  it('returns null for a row that is not a guest row', () => {
    expect(guestLabel({ beneficiary: PAYER, payment_guests: null }, 'guest')).toBeNull()
  })

  it('returns null when the embed was not selected at all', () => {
    expect(guestLabel({ beneficiary: PAYER }, 'guest')).toBeNull()
  })

  it('uses the tag it is given, so the label follows the active language', () => {
    expect(guestLabel({ payment_guests: { name: 'Nadia' } }, 'гост')).toBe('Nadia (гост)')
  })
})

describe('beneficiaryLabel', () => {
  // The regression this module exists for: on a guest row `beneficiary` is the
  // PAYER, because a guest has no ledger of their own. Reading it would render
  // the payer's name in the place where the guest's belongs.
  it('prefers the guest over the profile the row sits on', () => {
    expect(
      beneficiaryLabel({ beneficiary: PAYER, payment_guests: { name: 'Nadia' } }, 'guest'),
    ).toBe('Nadia (guest)')
  })

  it('names the profile on an ordinary row', () => {
    expect(beneficiaryLabel({ beneficiary: PAYER, payment_guests: null }, 'guest')).toBe('Ivan Petrov')
  })

  it('treats a row with the guest embed absent as an ordinary row', () => {
    expect(beneficiaryLabel({ beneficiary: PAYER }, 'guest')).toBe('Ivan Petrov')
  })

  it('falls back to an em dash rather than "undefined undefined"', () => {
    expect(beneficiaryLabel({}, 'guest')).toBe('—')
    expect(beneficiaryLabel({ beneficiary: null, payment_guests: null }, 'guest')).toBe('—')
  })
})
