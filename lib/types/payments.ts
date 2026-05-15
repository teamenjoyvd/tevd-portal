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
  profiles: { first_name: string; last_name: string; abo_number: string | null } | null
  trips: { title: string; destination: string } | null
  payable_items: { title: string; item_type: string; currency: string } | null
}
