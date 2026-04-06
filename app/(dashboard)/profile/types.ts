// ── Shared types for profile section components ──────────────────────────────
// All section components import from here. No type duplication across files.

export type UiPrefs = {
  bento_order?: string[]
  bento_collapsed?: Record<string, boolean>
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

export type PayableItem = {
  id: string
  title: string
  description: string | null
  amount: number
  currency: string
  item_type: string
}

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

export type VitalSign = {
  id: string
  definition_id: string
  recorded_at: string | null
  note: string | null
  created_at: string
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

// ── Shared sub-components ─────────────────────────────────────────────────────

import { formatDate, formatCurrency } from '@/lib/format'

export function ShowMoreButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 text-xs font-semibold hover:opacity-70 transition-opacity"
      style={{ color: 'var(--brand-crimson)' }}
    >
      +{count} more
    </button>
  )
}

export function TripRow({
  entry,
  onCancel,
  cancelPending,
}: {
  entry: TripEntry
  onCancel: (tripId: string) => void
  cancelPending: boolean
}) {
  if (!entry.trip) return null
  const isCancelled = !!entry.cancelled_at
  const regStyle = isCancelled
    ? REG_STATUS_STYLES.cancelled
    : (REG_STATUS_STYLES[entry.registration_status] ?? REG_STATUS_STYLES.pending)
  return (
    <div
      className="rounded-xl p-3"
      style={{ backgroundColor: 'var(--bg-global)', border: '1px solid var(--border-default)', opacity: isCancelled ? 0.7 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{entry.trip.title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{entry.trip.destination}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {formatDate(entry.trip.start_date)} – {formatDate(entry.trip.end_date)}
          </p>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: regStyle.bg, color: regStyle.color }}
        >
          {isCancelled ? 'cancelled' : entry.registration_status}
        </span>
      </div>
      {!isCancelled && (
        <button
          onClick={() => { if (confirm('Cancel your participation in this trip? This cannot be undone.')) onCancel(entry.trip!.id) }}
          disabled={cancelPending}
          className="mt-2 text-[11px] font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
          style={{ color: 'var(--brand-crimson)' }}
        >
          Cancel participation
        </button>
      )}
    </div>
  )
}

export function PaymentRow({
  pay,
  cancelledTripIds,
}: {
  pay: GenericPayment
  cancelledTripIds: Set<string>
}) {
  const ps = PAYMENT_STATUS_STYLES[pay.status] ?? PAYMENT_STATUS_STYLES.pending
  const linkedTripCancelled = pay.payable_items?.item_type === 'trip' && cancelledTripIds.size > 0
  return (
    <div
      className="flex items-center gap-2 text-xs rounded-xl px-3 py-2"
      style={{ backgroundColor: 'var(--bg-global)' }}
    >
      <span className="font-semibold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
        {formatCurrency(pay.amount, pay.payable_items?.currency ?? 'EUR')}
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>{formatDate(pay.transaction_date)}</span>
      {pay.payment_method && <span style={{ color: 'var(--text-secondary)' }}>{pay.payment_method}</span>}
      <span
        className="ml-auto font-semibold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
        style={{ backgroundColor: ps.bg, color: ps.color }}
      >
        {pay.status}
        {(pay.admin_note || linkedTripCancelled) && (
          <span title={linkedTripCancelled ? 'Trip was cancelled' : (pay.admin_note ?? '')} style={{ cursor: 'help', fontSize: 10, lineHeight: 1 }}>ⓘ</span>
        )}
      </span>
      {pay.proof_url && (
        <a href={pay.proof_url} target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 hover:underline" style={{ color: 'var(--brand-teal)' }}>proof ↗</a>
      )}
    </div>
  )
}
