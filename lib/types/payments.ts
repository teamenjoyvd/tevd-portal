// Domain types for the payments admin section.
// Extracted from app/admin/operations/components/operations-types.ts.

export type MembersResponse = {
  los_members: { profile: { id: string; first_name: string; last_name: string; abo_number: string | null } | null }[]
  manual_members_no_abo: { id: string; first_name: string; last_name: string; upline_abo_number: string | null }[]
}

export type MemberProfile = { id: string; first_name: string; last_name: string; abo_number: string | null }

export type Payment = {
  id: string
  amount: number
  currency: string
  transaction_date: string
  admin_status: string
  member_status: string
  payment_method: string | null
  proof_url: string | null
  note: string | null
  admin_note: string | null
  logged_by_admin: string | null
  created_at: string
  /** Non-null on rows from an on-behalf submission; all siblings share it. */
  payment_group_id: string | null
  /** Who actually transferred the money. NULL on legacy/self-paid rows, where the payer is the row owner. */
  paid_by_profile_id: string | null
  profiles: { first_name: string; last_name: string; abo_number: string | null } | null
  /** The payer, hinted off the third FK to profiles. NULL on legacy rows. */
  payer: { first_name: string; last_name: string; abo_number: string | null } | null
  trips: { title: string; destination: string } | null
  payable_items: { title: string; item_type: string; currency: string } | null
}
