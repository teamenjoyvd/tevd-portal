// ── Shared types for profile section components ──────────────────────────────
// All section components import types from here. No type duplication across files.

export type UiPrefs = {
  bento_order?: string[]
  bento_collapsed?: Record<string, boolean>
}

export type NotificationPrefs = {
  trip_registration_status: boolean
  payment_status: boolean
  abo_verification_result: boolean
  event_role_request_result: boolean
  document_expiring_soon: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  trip_registration_status: true,
  payment_status: true,
  abo_verification_result: true,
  event_role_request_result: true,
  document_expiring_soon: true,
}

export type Profile = {
  id: string
  clerk_id: string
  first_name: string
  last_name: string
  abo_number: string | null
  role: 'admin' | 'core' | 'member' | 'guest'
  document_active_type: 'id' | 'passport'
  id_number: string | null
  passport_number: string | null
  valid_through: string | null
  display_names: Record<string, string>
  created_at: string
  phone: string | null
  contact_email: string | null
  ui_prefs: UiPrefs | null
  notification_prefs: NotificationPrefs | null
}

export type VerificationRequest = {
  id: string
  claimed_abo: string | null
  claimed_upline_abo: string
  status: 'pending' | 'approved' | 'denied'
  admin_note: string | null
  created_at: string
  request_type: string
}

export type UplineData = {
  upline_name: string | null
  upline_abo_number: string | null
}

export type TripPayment = {
  id: string
  trip_id: string
  amount: number
  transaction_date: string
  status: 'pending' | 'completed' | 'failed'
  payment_method: string | null
  proof_url: string | null
  note: string | null
  submitted_by_member: boolean
  created_at: string
}

export type TripEntry = {
  registration_id: string
  registration_status: 'pending' | 'approved' | 'denied'
  registered_at: string
  cancelled_at?: string | null
  trip: {
    id: string
    title: string
    destination: string
    start_date: string
    end_date: string
    total_cost: number
    currency: string
  } | null
  payments: TripPayment[]
}

// PayableItem is the canonical type — defined in components/payment/types.ts
export type { PayableItem } from '@/components/payment/types'

export type GenericPayment = {
  id: string
  amount: number
  transaction_date: string
  status: string
  payment_method: string | null
  proof_url: string | null
  note: string | null
  admin_note: string | null
  created_at: string
  payable_items: {
    id: string
    title: string
    item_type: string
    currency: string
  } | null
}

// VitalSign canonical type and predicate live in lib/vitals.ts.
// Re-exported here so profile components can import from a single local barrel.
export type { VitalSign } from '@/lib/vitals'
export { isVitalRecorded } from '@/lib/vitals'

// Profile API response extends the base VitalSign with the nested definition shape
// returned by /api/profile/vital-signs.
export type ProfileVitalSign = VitalSign & {
  id: string
  is_recorded: boolean
  created_at: string | null
  vital_sign_definitions: {
    category: string
    label: string
    sort_order: number
  } | null
}

export type EventRoleRequest = {
  id: string
  role_label: string
  status: 'pending' | 'approved' | 'denied'
  note: string | null
  created_at: string
  calendar_events: {
    id: string
    title: string
    start_time: string
  } | null
}

export type LosSummaryData = {
  depth: number | null
  direct_downline_count: number
}

// ── Shared constants ──────────────────────────────────────────────────────────

export const VARIABLE_CAP = 5

export const PAYMENT_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#f2cc8f33', color: '#7a5c00' },
  completed: { bg: 'rgba(129,178,154,0.15)', color: '#2d6a4f' },
  approved:  { bg: 'rgba(129,178,154,0.15)', color: '#2d6a4f' },
  failed:    { bg: 'rgba(188,71,73,0.10)', color: '#bc4749' },
  denied:    { bg: 'rgba(188,71,73,0.10)', color: '#bc4749' },
}

export const REG_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#f2cc8f33', color: '#7a5c00' },
  approved:  { bg: 'rgba(129,178,154,0.15)', color: '#2d6a4f' },
  denied:    { bg: 'rgba(188,71,73,0.10)', color: '#bc4749' },
  cancelled: { bg: 'rgba(138,133,119,0.15)', color: '#5c5950' },
}
