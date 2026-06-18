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
  gpv: number
  ppv: number
  bonus_percent: number
  gbv: number
  customer_pv: number
  ruby_pv: number
  customers: number
  points_to_next_level: number
  qualified_legs: number
  group_size: number
  personal_order_count: number
  group_orders_count: number
  sponsoring: number
  annual_ppv: number
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
