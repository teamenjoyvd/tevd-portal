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

// One row of /api/events/[id]/registrations — the shape returned by
// get_event_registrations_for_viewer (2608-DEV-709). Covers members and
// guests alike; `is_member` says which.
export type EventRegistration = {
  id: string
  registrant: string
  // NULL on member rows, and enforced there by
  // guest_registrations_guest_xor_member_chk rather than by any masking code.
  email: string | null
  profile_id: string | null
  is_member: boolean
  status: string
  attended_at: string | null
  cancelled_at: string | null
  created_at: string
  sharer_name: string | null
}

export type CallerRegistration = {
  id: string
  status: string
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
  is_all_day: boolean
  category: 'N21' | 'Personal'
  event_type: 'in-person' | 'online' | 'hybrid' | null
  week_number: number
  role_slots: RoleSlot[]
  caller_registration: CallerRegistration | null
}
