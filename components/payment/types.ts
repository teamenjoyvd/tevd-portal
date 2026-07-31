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

// Paying on behalf of others (2607-DEV-676).

/** Mirrors the `relation` column of the get_payable_beneficiaries RPC. */
export type BeneficiaryRelation = 'self' | 'household' | 'downline' | 'guest'

/** One row of GET /api/payments/beneficiaries — the picker's only source. */
export type Beneficiary = {
  profile_id: string
  first_name: string
  last_name: string
  abo_number: string | null
  role: string
  relation: BeneficiaryRelation
}

/** Section order in the picker; also the sort order the RPC returns. */
export const RELATION_ORDER: BeneficiaryRelation[] = ['self', 'household', 'downline', 'guest']
