export type CallerRequest = {
  id: string
  role_label: string
  status: 'pending' | 'approved' | 'denied'
}

export type PendingProfile = {
  profile_id: string
  first_name: string | null
  last_name: string | null
}

export type RoleSlot = {
  role_label: string
  status: 'open' | 'contested' | 'filled'
  assigned_profile: { first_name: string | null; last_name: string | null } | null
  pending_profiles: PendingProfile[]
  caller_request: CallerRequest | null
}

export type GuestRegistration = {
  id: string
  name: string
  email: string
  status: string
  attended_at: string | null
  created_at: string
  sharer_name: string | null
}

export type EventDetail = {
  id: string
  title: string
  description: string | null
  meeting_url: string | null
  allow_guest_registration: boolean
  available_roles: string[]
  start_time: string
  end_time: string
  category: 'N21' | 'Personal'
  event_type: 'in-person' | 'online' | 'hybrid' | null
  week_number: number
  role_slots: RoleSlot[]
}
