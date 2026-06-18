export type LOSMember = {
  // DB fields
  abo_number: string
  sponsor_abo_number: string | null
  abo_level: string | null
  country: string | null
  name: string | null
  entry_date: string | null
  phone: string | null
  email: string | null
  address: string | null
  renewal_date: string | null
  gpv: number | null
  ppv: number | null
  bonus_percent: number | null
  gbv: number | null
  customer_pv: number | null
  ruby_pv: number | null
  customers: number | null
  points_to_next_level: number | null
  qualified_legs: number | null
  group_size: number | null
  personal_order_count: number | null
  group_orders_count: number | null
  sponsoring: number | null
  annual_ppv: number | null
  last_synced_at: string | null

  // Joins
  profile: {
    id: string
    first_name: string
    last_name: string
    role: string
    primary_profile_id: string | null
  } | null
}

export type MembersData = {
  los_members: LOSMember[]
}
