// Shared payment types — used by PaymentForm and profile route components.
// Profile types.ts re-exports PayableItem from here.

export type PayableItem = {
  id: string
  title: string
  description: string | null
  amount: number
  currency: string
  item_type: string
}

// Paying on behalf of others (2607-DEV-676, extended by 2607-DEV-677).

/**
 * `guest` is an ABO-less APPROVED MEMBER from the get_payable_beneficiaries RPC
 * — a real profile. `external` is an ad-hoc person with no account at all
 * (2607-DEV-677). The two are unrelated despite the English; #676 shipped the
 * first name and nothing was renamed.
 */
export type BeneficiaryRelation = 'self' | 'household' | 'downline' | 'guest' | 'external'

/** A beneficiary who has a profiles row. */
export type ProfileBeneficiary = {
  kind: 'profile'
  profile_id: string
  first_name: string
  last_name: string
  abo_number: string | null
  role: string
  relation: Exclude<BeneficiaryRelation, 'external'>
}

/** An ad-hoc guest this payer has paid for before, remembered server-side. */
export type GuestBeneficiary = {
  kind: 'guest'
  guest_id: string
  name: string
  email: string | null
  relation: 'external'
}

/** One row of GET /api/payments/beneficiaries — the picker's only source. */
export type Beneficiary = ProfileBeneficiary | GuestBeneficiary

/**
 * A guest typed into the picker but not yet created: the `payment_guests` row is
 * written server-side, inside the submit transaction, so that abandoning the
 * form leaves nothing behind.
 */
export type DraftGuest = {
  kind: 'draftGuest'
  /** Client-generated, unique for this form instance only. */
  key: string
  name: string
  email: string | null
  relation: 'external'
}

/** Section order in the picker; also the sort order the RPC returns. */
export const RELATION_ORDER: BeneficiaryRelation[] = [
  'self', 'household', 'downline', 'guest', 'external',
]

/**
 * Row identity inside the split editor.
 *
 * `SplitRow.profileId` is really a row KEY: lib/payments/split.ts treats it as
 * an opaque string, so guests ride the same code path as profiles without the
 * split arithmetic — or its tests — needing to know they exist. A profile keeps
 * its bare uuid, so a profile-only submission is byte-identical to #676's.
 */
export const GUEST_KEY_PREFIX = 'guest:'
export const DRAFT_GUEST_KEY_PREFIX = 'newguest:'

export function rowKeyOf(b: Beneficiary | DraftGuest): string {
  if (b.kind === 'profile') return b.profile_id
  if (b.kind === 'guest') return `${GUEST_KEY_PREFIX}${b.guest_id}`
  return `${DRAFT_GUEST_KEY_PREFIX}${b.key}`
}

export function displayNameOf(b: Beneficiary | DraftGuest): string {
  return b.kind === 'profile' ? `${b.first_name} ${b.last_name}` : b.name
}

/**
 * Mirrors `guestIdentityKey` in lib/payments/eligibility.ts and the expression
 * behind `uq_payment_guests_owner_identity`. Used to stop the same person being
 * added twice on one payment — once from the remembered list and once re-typed.
 *
 * JSON-encoded for the same reason as the server copy: any plain delimiter
 * admits a collision, since a name may contain any character a user can type.
 */
export function guestIdentity(name: string, email?: string | null): string {
  return JSON.stringify([name.trim().toLowerCase(), (email ?? '').trim().toLowerCase()])
}
