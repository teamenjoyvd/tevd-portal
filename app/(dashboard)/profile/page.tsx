'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, useCallback, forwardRef, memo, type ReactNode } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate, formatCurrency } from '@/lib/format'
import { getRoleColors } from '@/lib/role-colors'
import { Drawer } from '@/components/ui/Drawer'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PersonalDetailsContent } from './components/PersonalDetailsContent'
import { AboInfoContent } from './components/AboInfoContent'
import { TravelDocContent } from './components/TravelDocContent'
import { UserSettingsContent } from './components/UserSettingsContent'
import { PersonalDrawerForm } from './components/PersonalDrawerForm'
import { TravelDocDrawerForm } from './components/TravelDocDrawerForm'

// ── Types ─────────────────────────────────────────────────────────────────────

type UiPrefs = {
  bento_order?: string[]
  bento_collapsed?: Record<string, boolean>
}

type Profile = {
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

type VerificationRequest = {
  id: string
  claimed_abo: string | null
  claimed_upline_abo: string
  status: 'pending' | 'approved' | 'denied'
  admin_note: string | null
  created_at: string
  request_type: string
}

type UplineData = {
  upline_name: string | null
  upline_abo_number: string | null
}

type TripPayment = {
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

type TripEntry = {
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

type PayableItem = {
  id: string
  title: string
  description: string | null
  amount: number
  currency: string
  item_type: string
}

type GenericPayment = {
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

type VitalSign = {
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

type EventRoleRequest = {
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

type LosSummaryData = {
  depth: number | null
  direct_downline_count: number
}

// ── Validation ────────────────────────────────────────────────────────────────

type PersonalFormFields = {
  first_name?: string
  last_name?: string
  bg_first?: string
  bg_last?: string
  phone?: string
  contact_email?: string
}

const LATIN_RE    = /^[A-Za-z\-']+$/
const CYRILLIC_RE = /^[\u0400-\u04FF\-']+$/
const PHONE_RE    = /^\+?\d{7,15}$/
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validatePersonalField(
  field: keyof PersonalFormFields,
  value: string,
): string {
  switch (field) {
    case 'first_name':
      if (!value.trim()) return 'Required'
      if (!LATIN_RE.test(value.trim())) return 'Latin letters, hyphens and apostrophes only'
      return ''
    case 'last_name':
      if (!value.trim()) return 'Required'
      if (!LATIN_RE.test(value.trim())) return 'Latin letters, hyphens and apostrophes only'
      return ''
    case 'bg_first':
      if (!value.trim()) return ''
      if (!CYRILLIC_RE.test(value.trim())) return 'Cyrillic letters, hyphens and apostrophes only'
      return ''
    case 'bg_last':
      if (!value.trim()) return ''
      if (!CYRILLIC_RE.test(value.trim())) return 'Cyrillic letters, hyphens and apostrophes only'
      return ''
    case 'phone':
      if (!value.trim()) return ''
      if (!PHONE_RE.test(value.trim())) return 'Enter a valid phone number (7–15 digits, optional leading +)'
      return ''
    case 'contact_email':
      if (!value.trim()) return ''
      if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address'
      return ''
    default:
      return ''
  }
}

function validateDocField(
  field: 'doc_number' | 'valid_through',
  value: string,
  context: { has_doc_type: boolean; doc_number: string },
): string {
  if (field === 'doc_number') {
    if (context.has_doc_type && !value.trim()) return 'Required when document type is set'
    return ''
  }
  if (field === 'valid_through') {
    if (!context.doc_number.trim()) return ''
    if (!value.trim()) return 'Required when document number is filled'
    if (isNaN(new Date(value).getTime())) return 'Enter a valid date'
    return ''
  }
  return ''
}

// ── Height tier constants ─────────────────────────────────────────────────────

const BENTO_HEIGHT = {
  S: 160,   // Travel Doc, Calendar, Stats, Admin
  M: 280,   // Personal Details, ABO Info, Settings; variable tiles at 1–2 items
  L: 400,   // Variable tiles at 3–5 items
} as const

const VARIABLE_CAP = 5

function bentoMinHeight(itemCount: number): number {
  if (itemCount <= 2) return BENTO_HEIGHT.M
  if (itemCount <= VARIABLE_CAP) return BENTO_HEIGHT.L
  return BENTO_HEIGHT.L
}

// ── Status style maps ─────────────────────────────────────────────────────────

const PAYMENT_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#f2cc8f33', color: '#7a5c00' },
  completed: { bg: 'rgba(129,178,154,0.15)', color: '#2d6a4f' },
  approved:  { bg: 'rgba(129,178,154,0.15)', color: '#2d6a4f' },
  failed:    { bg: 'rgba(188,71,73,0.10)', color: '#bc4749' },
  denied:    { bg: 'rgba(188,71,73,0.10)', color: '#bc4749' },
}

const REG_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#f2cc8f33', color: '#7a5c00' },
  approved:  { bg: 'rgba(129,178,154,0.15)', color: '#2d6a4f' },
  denied:    { bg: 'rgba(188,71,73,0.10)', color: '#bc4749' },
  cancelled: { bg: 'rgba(138,133,119,0.15)', color: '#5c5950' },
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', core: 'Core', member: 'Member', guest: 'Guest',
}

// ── Drag handle ───────────────────────────────────────────────────────────────

const DragHandle = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  function DragHandle(props, ref) {
    return (
      <span
        {...props}
        ref={ref}
        title="Drag to reorder"
        style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none', fontSize: 14, lineHeight: 1, color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}
      >
        ⠇
      </span>
    )
  }
)

// ── Bento label map ───────────────────────────────────────────────────────────

const BENTO_LABELS: Record<string, string> = {
  'personal-details': 'Personal Details',
  'abo-info':         'ABO Information',
  'travel-doc':       'Travel Document',
  'settings':         'Settings',
  'trips':            'Trips',
  'payments':         'Payments',
  'vitals':           'Vital Signs',
  'participation':    'Participation',
  'calendar':         'Calendar',
  'stats':            'Stats',
  'admin':            'Admin Tools',
}

// ── Bento ID constants ────────────────────────────────────────────────────────

const BENTO_IDS = {
  PERSONAL_DETAILS: 'personal-details',
  ABO_INFO:         'abo-info',
  TRAVEL_DOC:       'travel-doc',
  SETTINGS:         'settings',
  TRIPS:            'trips',
  PAYMENTS:         'payments',
  VITALS:           'vitals',
  PARTICIPATION:    'participation',
  CALENDAR:         'calendar',
  STATS:            'stats',
  ADMIN:            'admin',
}

// Default order tuned for gap-free pairing:
// Row 1: Personal Details (M) | ABO Info (M)
// Row 2: Trips (M/L)          | Payments (M/L)
// Row 3: Vitals (M/L)         | Participation (M/L)
// Row 4: Settings (M)         | Travel Doc (S) — Settings taller, Travel Doc shorter
// Row 5: Calendar (S)         | Stats (S)
// Row 6: Admin (S)            | —
const DEFAULT_ORDER: string[] = [
  BENTO_IDS.PERSONAL_DETAILS,
  BENTO_IDS.ABO_INFO,
  BENTO_IDS.TRIPS,
  BENTO_IDS.PAYMENTS,
  BENTO_IDS.VITALS,
  BENTO_IDS.PARTICIPATION,
  BENTO_IDS.SETTINGS,
  BENTO_IDS.TRAVEL_DOC,
  BENTO_IDS.CALENDAR,
  BENTO_IDS.STATS,
  BENTO_IDS.ADMIN,
]

// ── Show-more button ──────────────────────────────────────────────────────────

function ShowMoreButton({ count, onClick }: { count: number; onClick: () => void }) {
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

// ── Trip row (shared between tile and drawer) ─────────────────────────────────

function TripRow({
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

// ── Payment row (shared between tile and drawer) ──────────────────────────────

function PaymentRow({
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

// ── Sortable bento wrapper ────────────────────────────────────────────────────

function SortableBento({
  id,
  collapsed,
  onToggleCollapse,
  colSpan,
  minHeight,
  children,
}: {
  id: string
  collapsed: boolean
  onToggleCollapse: () => void
  colSpan: number
  minHeight: number
  children: ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    gridColumn: `span ${colSpan}`,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    minHeight: collapsed ? undefined : minHeight,
  }

  return (
    <div
      ref={setNodeRef}
      className={colSpan === 6 ? 'bento-mobile-full' : ''}
      style={style}
    >
      {collapsed ? (
        <div
          className="rounded-2xl px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-3">
            <DragHandle ref={setActivatorNodeRef} {...attributes} {...listeners} />
            <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--text-secondary)' }}>
              {BENTO_LABELS[id] ?? id}
            </span>
          </div>
          <button
            onClick={onToggleCollapse}
            title="Expand"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1, color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}
          >
            ▸
          </button>
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: 18, right: 16, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
            <DragHandle ref={setActivatorNodeRef} {...attributes} {...listeners} />
            <button
              onClick={onToggleCollapse}
              title="Collapse"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1, color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}
            >
              ▾
            </button>
          </div>
          <div style={{ overflow: 'hidden', height: '100%' }}>{children}</div>
        </>
      )}
    </div>
  )
}

// ── Memo'd tile components ────────────────────────────────────────────────────

const TripsContent = memo(function TripsContent({
  tripsData, onCancelTrip, cancelTripPending, onShowMore,
}: {
  tripsData: TripEntry[]
  onCancelTrip: (tripId: string) => void
  cancelTripPending: boolean
  onShowMore: () => void
}) {
  const visible = tripsData.slice(0, VARIABLE_CAP)
  const overflow = tripsData.length - VARIABLE_CAP
  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4 pr-16" style={{ color: 'var(--brand-crimson)' }}>Trips</p>
      <div className="space-y-2">
        {visible.map(entry => (
          <TripRow key={entry.registration_id} entry={entry} onCancel={onCancelTrip} cancelPending={cancelTripPending} />
        ))}
      </div>
      {overflow > 0 && <ShowMoreButton count={overflow} onClick={onShowMore} />}
    </div>
  )
})

const PaymentsContent = memo(function PaymentsContent({
  paymentsByItem, allPayments, cancelledTripIds, onOpenPayDrawer, onShowMore,
}: {
  paymentsByItem: Record<string, GenericPayment[]>
  allPayments: GenericPayment[]
  cancelledTripIds: Set<string>
  onOpenPayDrawer: () => void
  onShowMore: () => void
}) {
  const totalCount = allPayments.length
  const visiblePayments = allPayments.slice(0, VARIABLE_CAP)
  const overflow = totalCount - VARIABLE_CAP

  // Re-group visible slice by item title
  const visibleByItem: Record<string, GenericPayment[]> = {}
  for (const pay of visiblePayments) {
    const key = pay.payable_items?.title ?? 'Unknown'
    if (!visibleByItem[key]) visibleByItem[key] = []
    visibleByItem[key].push(pay)
  }

  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="flex items-center justify-between mb-4 pr-16">
        <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--brand-crimson)' }}>Payments</p>
        <button onClick={onOpenPayDrawer}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity flex-shrink-0"
          style={{ backgroundColor: 'var(--brand-forest)' }}>+ Submit payment</button>
      </div>
      {Object.keys(visibleByItem).length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No payments logged yet.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(visibleByItem).map(([itemTitle, itemPayments]) => (
            <div key={itemTitle}>
              <p className="text-[11px] font-semibold tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-secondary)' }}>{itemTitle}</p>
              <div className="space-y-1.5">
                {itemPayments.map(pay => (
                  <PaymentRow key={pay.id} pay={pay} cancelledTripIds={cancelledTripIds} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {overflow > 0 && <ShowMoreButton count={overflow} onClick={onShowMore} />}
    </div>
  )
})

const VitalsContent = memo(function VitalsContent({
  vitalsData, onShowMore,
}: {
  vitalsData: VitalSign[]
  onShowMore: () => void
}) {
  const visible = vitalsData.slice(0, VARIABLE_CAP)
  const overflow = vitalsData.length - VARIABLE_CAP
  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6 pr-16" style={{ color: 'var(--brand-crimson)' }}>Vital Signs</p>
      <div className="space-y-2">
        {visible.map(vs => {
          const label = vs.vital_sign_definitions?.label ?? vs.definition_id
          const category = vs.vital_sign_definitions?.category
          return (
            <div key={vs.id} className="flex items-center justify-between gap-3 text-xs py-1.5">
              <div className="min-w-0">
                <span style={{ color: 'var(--text-primary)' }}>{label}</span>
                {category && <span className="ml-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{category}</span>}
              </div>
              <span className="font-semibold px-2 py-0.5 rounded-full flex-shrink-0 text-[10px]"
                style={{ backgroundColor: vs.recorded_at ? 'rgba(188,71,73,0.12)' : 'var(--border-default)', color: vs.recorded_at ? 'var(--brand-crimson)' : 'var(--text-secondary)' }}>
                {vs.recorded_at ? '✓ Recorded' : '○ Not recorded'}
              </span>
            </div>
          )
        })}
      </div>
      {overflow > 0 && <ShowMoreButton count={overflow} onClick={onShowMore} />}
    </div>
  )
})

const ParticipationContent = memo(function ParticipationContent({
  eventRolesData, onShowMore,
}: {
  eventRolesData: EventRoleRequest[]
  onShowMore: () => void
}) {
  const visible = eventRolesData.slice(0, VARIABLE_CAP)
  const overflow = eventRolesData.length - VARIABLE_CAP
  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6 pr-16" style={{ color: 'var(--brand-crimson)' }}>Participation</p>
      <div className="space-y-2">
        {visible.map(er => {
          const rs = REG_STATUS_STYLES[er.status.toLowerCase()] ?? REG_STATUS_STYLES.pending
          return (
            <div key={er.id} className="flex items-start justify-between gap-3 text-xs py-1.5">
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{er.calendar_events?.title ?? '—'}</p>
                <p style={{ color: 'var(--text-secondary)' }}>{er.role_label}</p>
              </div>
              <span className="font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: rs.bg, color: rs.color }}>{er.status}</span>
            </div>
          )
        })}
      </div>
      {overflow > 0 && <ShowMoreButton count={overflow} onClick={onShowMore} />}
    </div>
  )
})

const CalendarContent = memo(function CalendarContent({
  calUrl, calCopied, onCopy, onRegenerate, regeneratePending,
  copyLabel, copiedLabel, subLabel, subDesc, subInstructions, regenerateLabel,
}: {
  calUrl: string; calCopied: boolean; onCopy: () => void; onRegenerate: () => void
  regeneratePending: boolean; copyLabel: string; copiedLabel: string
  subLabel: string; subDesc: string; subInstructions: string; regenerateLabel: string
}) {
  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>{subLabel}</p>
      <p className="text-xs mb-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{subDesc}</p>
      <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{subInstructions}</p>
      <div className="flex items-center gap-2">
        <input readOnly value={calUrl} placeholder="Generating…"
          className="flex-1 border rounded-xl px-3 py-2 text-xs font-mono truncate"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-global)' }} />
        <button onClick={onCopy} disabled={!calUrl}
          className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 hover:opacity-80 flex-shrink-0"
          style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}>
          {calCopied ? copiedLabel : copyLabel}
        </button>
        <button onClick={onRegenerate} disabled={regeneratePending}
          className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5 disabled:opacity-40 flex-shrink-0"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          {regenerateLabel}
        </button>
      </div>
    </div>
  )
})

const StatsContent = memo(function StatsContent({ role, losSummary }: { role: string; losSummary: LosSummaryData }) {
  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4 pr-16" style={{ color: 'var(--brand-crimson)' }}>STATS</p>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Role</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{ROLE_LABELS[role]}</p>
        </div>
        {losSummary.depth !== null && losSummary.depth !== undefined && (
          <div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Depth</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>Level {losSummary.depth}</p>
          </div>
        )}
        <div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Direct downlines</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{losSummary.direct_downline_count}</p>
        </div>
        <a href="/los"
          className="ml-auto px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-80 transition-opacity flex-shrink-0"
          style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}>VIEW LOS</a>
      </div>
    </div>
  )
})

const AdminContent = memo(function AdminContent() {
  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4 pr-16" style={{ color: 'var(--brand-teal)' }}>Admin Tools</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '12px' }}>
        <a href="/admin"
          style={{ gridColumn: 'span 2', backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}
          className="rounded-xl px-4 py-3 flex flex-col gap-1 hover:opacity-80 transition-opacity">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--brand-parchment)' }}>Admin</span>
          <span className="text-[10px] opacity-60" style={{ color: 'var(--brand-parchment)' }}>Portal management</span>
        </a>
      </div>
    </div>
  )
})

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="py-8 pb-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '12px' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ gridColumn: 'span 6', minHeight: BENTO_HEIGHT.M }} className="bento-mobile-full">
              <div className="h-full rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const qc = useQueryClient()
  const { t } = useLanguage()

  // ── Drawer open states ───────────────────────────────────────────────────
  const [personalDrawerOpen, setPersonalDrawerOpen]     = useState(false)
  const [travelDocDrawerOpen, setTravelDocDrawerOpen]   = useState(false)
  const [payDrawerOpen, setPayDrawerOpen]               = useState(false)
  const [tripsDrawerOpen, setTripsDrawerOpen]           = useState(false)
  const [paymentsDrawerOpen, setPaymentsDrawerOpen]     = useState(false)
  const [vitalsDrawerOpen, setVitalsDrawerOpen]         = useState(false)
  const [participationDrawerOpen, setParticipationDrawerOpen] = useState(false)

  // ── Saved flash ──────────────────────────────────────────────────────────
  const [savedPersonal, setSavedPersonal]     = useState(false)
  const [savedTravelDoc, setSavedTravelDoc]   = useState(false)

  // ── Personal form state ──────────────────────────────────────────────────
  const [personalForm, setPersonalForm] = useState<{
    first_name?: string
    last_name?: string
    display_names?: Record<string, string>
    phone?: string
    contact_email?: string
  }>({})
  const [personalErrors, setPersonalErrors] = useState<Partial<Record<keyof PersonalFormFields, string>>>({})

  // ── Travel doc form state ────────────────────────────────────────────────
  const [docForm, setDocForm] = useState<{
    document_active_type?: 'id' | 'passport'
    id_number?: string
    passport_number?: string
    valid_through?: string
  }>({})
  const [docErrors, setDocErrors] = useState<{ doc_number?: string; valid_through?: string }>({})

  // ── Payment drawer state ─────────────────────────────────────────────────
  const [payModalItemId, setPayModalItemId]   = useState('')
  const [payModalAmount, setPayModalAmount]   = useState('')
  const [payModalDate, setPayModalDate]       = useState('')
  const [payModalMethod, setPayModalMethod]   = useState('')
  const [payModalNote, setPayModalNote]       = useState('')
  const [payModalFile, setPayModalFile]       = useState<File | null>(null)

  // ── Cal copy state ───────────────────────────────────────────────────────
  const [calCopied, setCalCopied] = useState(false)

  // ── Drag/drop + collapse state ───────────────────────────────────────────
  const [bentoOrder, setBentoOrder]         = useState<string[]>(DEFAULT_ORDER)
  const [bentoCollapsed, setBentoCollapsed] = useState<Record<string, boolean>>({})
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
  })

  const validProfile = profile?.id ? profile : null

  // Restore persisted bento layout
  useEffect(() => {
    if (!validProfile) return
    const prefs = validProfile.ui_prefs ?? {}
    if (Array.isArray(prefs.bento_order) && prefs.bento_order.length > 0) {
      const savedOrder = prefs.bento_order as string[]
      const merged = [
        ...savedOrder.filter(id => DEFAULT_ORDER.includes(id)),
        ...DEFAULT_ORDER.filter(id => !savedOrder.includes(id)),
      ]
      setBentoOrder(merged)
    }
    if (prefs.bento_collapsed && typeof prefs.bento_collapsed === 'object') {
      setBentoCollapsed(prefs.bento_collapsed as Record<string, boolean>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validProfile?.id])

  // Seed form state when profile loads
  useEffect(() => {
    if (!validProfile) return
    setPersonalForm({
      first_name:    validProfile.first_name,
      last_name:     validProfile.last_name,
      display_names: validProfile.display_names ?? {},
      phone:         validProfile.phone ?? '',
      contact_email: validProfile.contact_email ?? '',
    })
    setDocForm({
      document_active_type: validProfile.document_active_type,
      id_number:            validProfile.id_number ?? '',
      passport_number:      validProfile.passport_number ?? '',
      valid_through:        validProfile.valid_through ?? '',
    })
  }, [validProfile])

  const { data: verRequest } = useQuery<VerificationRequest | null>({
    queryKey: ['verify-abo'],
    queryFn: () => fetch('/api/profile/verify-abo').then(r => r.json()),
    enabled: !!validProfile && validProfile.role === 'guest',
  })

  const { data: uplineData } = useQuery<UplineData>({
    queryKey: ['profile-upline'],
    queryFn: () => fetch('/api/profile/upline').then(r => r.json()),
    enabled: !!validProfile?.abo_number,
    staleTime: 10 * 60 * 1000,
  })

  const { data: tripsData, isLoading: tripsLoading } = useQuery<TripEntry[]>({
    queryKey: ['profile-trips'],
    queryFn: () => fetch('/api/profile/payments').then(r => r.json()),
    enabled: !!validProfile?.id && validProfile?.role !== 'guest',
    staleTime: 2 * 60 * 1000,
  })

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<GenericPayment[]>({
    queryKey: ['profile-generic-payments'],
    queryFn: () => fetch('/api/payments').then(r => r.json()),
    enabled: !!validProfile?.id && validProfile?.role !== 'guest',
    staleTime: 2 * 60 * 1000,
  })

  const { data: payableItems } = useQuery<PayableItem[]>({
    queryKey: ['payable-items'],
    queryFn: () => fetch('/api/payable-items').then(r => r.json()),
    enabled: !!validProfile?.id && validProfile?.role !== 'guest',
    staleTime: 5 * 60 * 1000,
  })

  const { data: vitalsData, isLoading: vitalsLoading } = useQuery<VitalSign[]>({
    queryKey: ['profile-vitals'],
    // Fixed: was calling deprecated /api/profile/vitals — now uses canonical route
    queryFn: () => fetch('/api/profile/vital-signs').then(r => r.json()),
    enabled: !!validProfile?.id && validProfile?.role !== 'guest',
    staleTime: 5 * 60 * 1000,
  })

  const { data: eventRolesData, isLoading: eventRolesLoading } = useQuery<EventRoleRequest[]>({
    queryKey: ['profile-event-roles'],
    queryFn: () => fetch('/api/profile/event-roles').then(r => r.json()),
    enabled: !!validProfile?.id && validProfile?.role !== 'guest',
    staleTime: 5 * 60 * 1000,
  })

  const { data: losSummary, isLoading: losSummaryLoading } = useQuery<LosSummaryData>({
    queryKey: ['profile-los-summary'],
    queryFn: () => fetch('/api/profile/los-summary').then(r => r.json()),
    enabled: !!validProfile?.abo_number,
    staleTime: 5 * 60 * 1000,
  })

  const { data: calData, refetch: refetchCal } = useQuery<{ url: string }>({
    queryKey: ['cal-feed-token'],
    queryFn: () => fetch('/api/calendar/feed-token').then(r => r.json()),
    enabled: !!validProfile,
    staleTime: Infinity,
  })

  // ── Mutations ────────────────────────────────────────────────────────────

  const savePersonal = useMutation({
    mutationFn: async () => {
      const payload = {
        first_name:    personalForm.first_name,
        last_name:     personalForm.last_name,
        display_names: personalForm.display_names,
        phone:         personalForm.phone || null,
        contact_email: personalForm.contact_email || null,
      }
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Save failed')
      return r.json() as Promise<Profile>
    },
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      setSavedPersonal(true)
      setPersonalDrawerOpen(false)
      setPersonalErrors({})
      setTimeout(() => setSavedPersonal(false), 2500)
    },
  })

  const saveTravelDoc = useMutation({
    mutationFn: async () => {
      const payload = {
        document_active_type: docForm.document_active_type,
        id_number:       docForm.id_number       || null,
        passport_number: docForm.passport_number || null,
        valid_through:   docForm.valid_through   || null,
      }
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Save failed')
      return r.json() as Promise<Profile>
    },
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      setSavedTravelDoc(true)
      setTravelDocDrawerOpen(false)
      setDocErrors({})
      setTimeout(() => setSavedTravelDoc(false), 2500)
    },
  })

  const submitVerification = useMutation({
    mutationFn: (params: { claimed_abo?: string; claimed_upline_abo: string; request_type: 'standard' | 'manual' }) =>
      fetch('/api/profile/verify-abo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          params.request_type === 'manual'
            ? { request_type: 'manual', claimed_upline_abo: params.claimed_upline_abo }
            : { claimed_abo: params.claimed_abo, claimed_upline_abo: params.claimed_upline_abo }
        ),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verify-abo'] }),
  })

  const cancelVerification = useMutation({
    mutationFn: () => fetch('/api/profile/verify-abo', { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verify-abo'] }),
  })

  const cancelTrip = useMutation({
    mutationFn: (tripId: string) =>
      fetch(`/api/profile/trips/${tripId}/cancel`, { method: 'POST' }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-trips'] }),
  })

  const regenerateCal = useMutation({
    mutationFn: () => fetch('/api/calendar/feed-token', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => refetchCal(),
  })

  const submitGenericPayment = useMutation({
    mutationFn: async () => {
      let proofUrl: string | null = null
      if (payModalFile) {
        const fd = new FormData()
        fd.append('file', payModalFile)
        const uploadRes = await fetch('/api/profile/payments/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) throw new Error('File upload failed')
        proofUrl = (await uploadRes.json()).url
      }
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payable_item_id:  payModalItemId,
          amount:           parseFloat(payModalAmount),
          transaction_date: payModalDate,
          payment_method:   payModalMethod || null,
          proof_url:        proofUrl,
          note:             payModalNote || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-generic-payments'] })
      closePayDrawer()
    },
  })

  // ── Persist bento prefs ──────────────────────────────────────────────────
  const persistPrefs = useCallback((order: string[], collapsed: Record<string, boolean>) => {
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current)
    persistDebounceRef.current = setTimeout(() => {
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_prefs: { bento_order: order, bento_collapsed: collapsed } }),
      }).catch(() => { /* silent */ })
    }, 500)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBentoOrder(prev => {
      const oldIndex = prev.indexOf(active.id as string)
      const newIndex = prev.indexOf(over.id as string)
      const next = arrayMove(prev, oldIndex, newIndex)
      persistPrefs(next, bentoCollapsed)
      return next
    })
  }, [bentoCollapsed, persistPrefs])

  const toggleCollapse = useCallback((id: string) => {
    setBentoCollapsed(prev => {
      const next = { ...prev, [id]: !prev[id] }
      setBentoOrder(order => { persistPrefs(order, next); return order })
      return next
    })
  }, [persistPrefs])

  const resetLayout = useCallback(() => {
    setBentoOrder(DEFAULT_ORDER)
    setBentoCollapsed({})
    persistPrefs(DEFAULT_ORDER, {})
  }, [persistPrefs])

  // ── Stable callbacks for memo'd tiles ───────────────────────────────────
  const handleCancelTrip    = useCallback((tripId: string) => { cancelTrip.mutate(tripId) }, [cancelTrip])
  const handleOpenPayDrawer = useCallback(() => { setPayDrawerOpen(true) }, [])
  const handleCalCopy       = useCallback(() => {
    if (calData?.url) {
      navigator.clipboard.writeText(calData.url)
      setCalCopied(true)
      setTimeout(() => setCalCopied(false), 2000)
    }
  }, [calData?.url])
  const handleCalRegenerate = useCallback(() => {
    if (confirm('Regenerate your calendar link? Your old link will stop working.')) regenerateCal.mutate()
  }, [regenerateCal])

  const handleShowMoreTrips         = useCallback(() => setTripsDrawerOpen(true), [])
  const handleShowMorePayments      = useCallback(() => setPaymentsDrawerOpen(true), [])
  const handleShowMoreVitals        = useCallback(() => setVitalsDrawerOpen(true), [])
  const handleShowMoreParticipation = useCallback(() => setParticipationDrawerOpen(true), [])

  // ── Sensors ──────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  function closePayDrawer() {
    setPayDrawerOpen(false)
    setPayModalItemId(''); setPayModalAmount(''); setPayModalDate('')
    setPayModalMethod(''); setPayModalNote(''); setPayModalFile(null)
    submitGenericPayment.reset()
  }

  // ── Personal form helpers ────────────────────────────────────────────────
  function handlePersonalChange(field: keyof PersonalFormFields, value: string) {
    if (field === 'bg_first' || field === 'bg_last') {
      const dnKey = field === 'bg_first' ? 'bg_first' : 'bg_last'
      setPersonalForm(f => ({ ...f, display_names: { ...((f.display_names ?? {}) as Record<string,string>), [dnKey]: value } }))
    } else {
      setPersonalForm(f => ({ ...f, [field]: value }))
    }
  }
  function handlePersonalBlur(field: keyof PersonalFormFields, value: string) {
    const err = validatePersonalField(field, value)
    setPersonalErrors(prev => ({ ...prev, [field]: err }))
  }
  function clearPersonalError(field: keyof PersonalFormFields) {
    setPersonalErrors(prev => { if (!prev[field]) return prev; const n = { ...prev }; delete n[field]; return n })
  }

  // ── Travel doc form helpers ──────────────────────────────────────────────
  function handleDocTypeChange(dt: 'id' | 'passport') {
    setDocForm(f => ({ ...f, document_active_type: dt }))
  }
  function handleDocNumberChange(v: string) {
    const field = docForm.document_active_type === 'passport' ? 'passport_number' : 'id_number'
    setDocForm(f => ({ ...f, [field]: v }))
  }
  function handleDocNumberBlur(v: string) {
    const err = validateDocField('doc_number', v, { has_doc_type: !!(docForm.document_active_type), doc_number: v })
    setDocErrors(prev => ({ ...prev, doc_number: err }))
  }
  function handleValidThroughBlur(v: string) {
    const docNumber = docForm.document_active_type === 'passport' ? (docForm.passport_number ?? '') : (docForm.id_number ?? '')
    const err = validateDocField('valid_through', v, { has_doc_type: true, doc_number: docNumber })
    setDocErrors(prev => ({ ...prev, valid_through: err }))
  }
  function clearDocError(f: 'doc_number' | 'valid_through') {
    setDocErrors(prev => { const n = { ...prev }; delete n[f]; return n })
  }

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (isLoading || !validProfile) return <ProfileSkeleton />

  const p = validProfile
  const isGuest = p.role === 'guest' && !p.abo_number
  const isAdmin = p.role === 'admin'

  const hasTrips      = Array.isArray(tripsData) && tripsData.length > 0
  const hasVitals     = Array.isArray(vitalsData) && vitalsData.length > 0
  const hasEventRoles = Array.isArray(eventRolesData) && eventRolesData.length > 0

  type AboMode = 'form' | 'pending' | 'confirmed' | 'member_manual'
  let aboMode: AboMode = 'form'
  if (p.abo_number) {
    aboMode = 'confirmed'
  } else if (p.role !== 'guest') {
    // Manually-verified member: role promoted but no ABO number assigned
    aboMode = 'member_manual'
  } else if (verRequest && (verRequest.status === 'pending' || verRequest.status === 'denied')) {
    aboMode = 'pending'
  }

  const allPayments = paymentsData ?? []
  const paymentsByItem: Record<string, GenericPayment[]> = {}
  for (const pay of allPayments) {
    const key = pay.payable_items?.title ?? 'Unknown'
    if (!paymentsByItem[key]) paymentsByItem[key] = []
    paymentsByItem[key].push(pay)
  }
  const cancelledTripIds = new Set(
    (tripsData ?? []).filter(e => e.cancelled_at).map(e => e.trip?.id).filter(Boolean) as string[]
  )

  // ── Bento map ─────────────────────────────────────────────────────────────
  type BentoEntry = { colSpan: number; minHeight: number; node: ReactNode }

  const bentoMap: Record<string, BentoEntry | null> = {
    [BENTO_IDS.PERSONAL_DETAILS]: {
      colSpan: 6,
      minHeight: BENTO_HEIGHT.M,
      node: (
        <PersonalDetailsContent
          profile={p}
          incomplete={!p.first_name}
          onEdit={() => setPersonalDrawerOpen(true)}
        />
      ),
    },

    [BENTO_IDS.ABO_INFO]: {
      colSpan: 6,
      minHeight: BENTO_HEIGHT.M,
      node: (
        <AboInfoContent
          mode={aboMode}
          role={p.role}
          aboNumber={p.abo_number}
          uplineData={uplineData}
          verRequest={verRequest}
          onSubmitVerification={params => submitVerification.mutate(params)}
          onCancelVerification={() => cancelVerification.mutate()}
          submitPending={submitVerification.isPending}
          cancelPending={cancelVerification.isPending}
          submitError={submitVerification.isError ? (submitVerification.error as Error).message : null}
        />
      ),
    },

    [BENTO_IDS.TRAVEL_DOC]: !isGuest ? {
      colSpan: 6,
      minHeight: BENTO_HEIGHT.S,
      node: (
        <TravelDocContent
          profile={p}
          onEdit={() => setTravelDocDrawerOpen(true)}
        />
      ),
    } : null,

    [BENTO_IDS.SETTINGS]: {
      colSpan: 6,
      minHeight: BENTO_HEIGHT.M,
      node: <UserSettingsContent />,
    },

    [BENTO_IDS.TRIPS]: !isGuest
      ? tripsLoading
        ? { colSpan: 6, minHeight: BENTO_HEIGHT.M, node: <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} /> }
        : hasTrips
          ? {
              colSpan: 6,
              minHeight: bentoMinHeight(tripsData!.length),
              node: <TripsContent tripsData={tripsData!} onCancelTrip={handleCancelTrip} cancelTripPending={cancelTrip.isPending} onShowMore={handleShowMoreTrips} />,
            }
          : null
      : null,

    [BENTO_IDS.PAYMENTS]: !isGuest
      ? paymentsLoading
        ? { colSpan: 6, minHeight: BENTO_HEIGHT.M, node: <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} /> }
        : {
            colSpan: 6,
            minHeight: bentoMinHeight(allPayments.length),
            node: <PaymentsContent paymentsByItem={paymentsByItem} allPayments={allPayments} cancelledTripIds={cancelledTripIds} onOpenPayDrawer={handleOpenPayDrawer} onShowMore={handleShowMorePayments} />,
          }
      : null,

    [BENTO_IDS.VITALS]: !isGuest
      ? vitalsLoading
        ? { colSpan: 6, minHeight: BENTO_HEIGHT.M, node: <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} /> }
        : hasVitals
          ? {
              colSpan: 6,
              minHeight: bentoMinHeight(vitalsData!.length),
              node: <VitalsContent vitalsData={vitalsData!} onShowMore={handleShowMoreVitals} />,
            }
          : null
      : null,

    [BENTO_IDS.PARTICIPATION]: !isGuest
      ? eventRolesLoading
        ? { colSpan: 6, minHeight: BENTO_HEIGHT.M, node: <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} /> }
        : hasEventRoles
          ? {
              colSpan: 6,
              minHeight: bentoMinHeight(eventRolesData!.length),
              node: <ParticipationContent eventRolesData={eventRolesData!} onShowMore={handleShowMoreParticipation} />,
            }
          : null
      : null,

    [BENTO_IDS.CALENDAR]: {
      colSpan: 6,
      minHeight: BENTO_HEIGHT.S,
      node: (
        <CalendarContent
          calUrl={calData?.url ?? ''}
          calCopied={calCopied}
          onCopy={handleCalCopy}
          onRegenerate={handleCalRegenerate}
          regeneratePending={regenerateCal.isPending}
          copyLabel={t('profile.calSubCopy')}
          copiedLabel={t('profile.calSubCopied')}
          subLabel={t('profile.calSub')}
          subDesc={t('profile.calSubDesc')}
          subInstructions={t('profile.calSubInstructions')}
          regenerateLabel={t('profile.calSubRegenerate')}
        />
      ),
    },

    [BENTO_IDS.STATS]: p.abo_number
      ? losSummaryLoading
        ? { colSpan: 6, minHeight: BENTO_HEIGHT.S, node: <div className="rounded-2xl animate-pulse h-full" style={{ backgroundColor: 'var(--border-default)' }} /> }
        : losSummary
          ? { colSpan: 6, minHeight: BENTO_HEIGHT.S, node: <StatsContent role={p.role} losSummary={losSummary} /> }
          : null
      : null,

    [BENTO_IDS.ADMIN]: isAdmin
      ? { colSpan: 6, minHeight: BENTO_HEIGHT.S, node: <AdminContent /> }
      : null,
  }

  const orderedBentos = bentoOrder
    .map(id => ({ id, entry: bentoMap[id] ?? null }))
    .filter((b): b is { id: string; entry: BentoEntry } => b.entry !== null)

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8">

        {/* Reset layout button */}
        <div className="flex justify-end mb-3">
          <button
            onClick={resetLayout}
            className="text-xs font-medium hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('profile.resetLayout')}
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedBentos.map(b => b.id)} strategy={rectSortingStrategy}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '12px' }}>
              {orderedBentos.map(({ id, entry }) => (
                <SortableBento
                  key={id}
                  id={id}
                  collapsed={!!bentoCollapsed[id]}
                  onToggleCollapse={() => toggleCollapse(id)}
                  colSpan={entry.colSpan}
                  minHeight={entry.minHeight}
                >
                  {entry.node}
                </SortableBento>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* ── Personal Details Drawer ─────────────────────────────────────── */}
      <Drawer open={personalDrawerOpen} onClose={() => { setPersonalDrawerOpen(false); setPersonalErrors({}); savePersonal.reset() }} title={t('profile.tile.personalDetails')}>
        <PersonalDrawerForm
          form={personalForm}
          formErrors={personalErrors}
          onChange={handlePersonalChange}
          onBlur={handlePersonalBlur}
          onClearError={clearPersonalError}
          onCancel={() => { setPersonalDrawerOpen(false); setPersonalErrors({}); savePersonal.reset() }}
          onSave={() => savePersonal.mutate()}
          isPending={savePersonal.isPending}
          isError={savePersonal.isError}
          errorMessage={savePersonal.isError ? (savePersonal.error as Error).message : ''}
          saved={savedPersonal}
        />
      </Drawer>

      {/* ── Travel Document Drawer ──────────────────────────────────────── */}
      <Drawer open={travelDocDrawerOpen} onClose={() => { setTravelDocDrawerOpen(false); setDocErrors({}); saveTravelDoc.reset() }} title={t('profile.tile.travelDoc')}>
        <TravelDocDrawerForm
          form={docForm}
          formErrors={docErrors}
          onDocTypeChange={handleDocTypeChange}
          onDocNumberChange={handleDocNumberChange}
          onValidThroughChange={v => setDocForm(f => ({ ...f, valid_through: v }))}
          onDocNumberBlur={handleDocNumberBlur}
          onValidThroughBlur={handleValidThroughBlur}
          onClearError={clearDocError}
          onCancel={() => { setTravelDocDrawerOpen(false); setDocErrors({}); saveTravelDoc.reset() }}
          onSave={() => saveTravelDoc.mutate()}
          isPending={saveTravelDoc.isPending}
          isError={saveTravelDoc.isError}
          errorMessage={saveTravelDoc.isError ? (saveTravelDoc.error as Error).message : ''}
          saved={savedTravelDoc}
        />
      </Drawer>

      {/* ── Submit Payment Drawer ───────────────────────────────────────── */}
      <Drawer open={payDrawerOpen} onClose={closePayDrawer} title="Submit Payment">
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Item</label>
            <select value={payModalItemId} onChange={e => setPayModalItemId(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}>
              <option value="">Select an item…</option>
              {(payableItems ?? []).map(item => (
                <option key={item.id} value={item.id}>{item.title} — {formatCurrency(item.amount, item.currency)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Amount</label>
              <input type="number" min="0" step="0.01" value={payModalAmount} onChange={e => setPayModalAmount(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" value={payModalDate} onChange={e => setPayModalDate(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Payment method</label>
            <input value={payModalMethod} onChange={e => setPayModalMethod(e.target.value)}
              placeholder="e.g. bank transfer, cash"
              className="w-full border rounded-xl px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Proof of payment <span className="opacity-60 font-normal">(optional)</span></label>
            <input type="file" accept="image/*,.pdf" onChange={e => setPayModalFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs" style={{ color: 'var(--text-secondary)' }} />
            {payModalFile && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-teal)' }}>{payModalFile.name}</p>}
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Note</label>
            <textarea value={payModalNote} onChange={e => setPayModalNote(e.target.value)}
              rows={2} className="w-full border rounded-xl px-3 py-2 text-sm resize-none"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }} />
          </div>
          {submitGenericPayment.isError && (
            <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{(submitGenericPayment.error as Error).message}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={closePayDrawer}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-black/5 transition-colors"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button
              onClick={() => submitGenericPayment.mutate()}
              disabled={submitGenericPayment.isPending || !payModalItemId || !payModalAmount || !payModalDate}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--brand-forest)' }}>
              {submitGenericPayment.isPending ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </Drawer>

      {/* ── Trips full-list Drawer ──────────────────────────────────────── */}
      <Drawer open={tripsDrawerOpen} onClose={() => setTripsDrawerOpen(false)} title="All Trips">
        <div className="space-y-2">
          {(tripsData ?? []).map(entry => (
            <TripRow
              key={entry.registration_id}
              entry={entry}
              onCancel={handleCancelTrip}
              cancelPending={cancelTrip.isPending}
            />
          ))}
        </div>
      </Drawer>

      {/* ── Payments full-list Drawer ───────────────────────────────────── */}
      <Drawer open={paymentsDrawerOpen} onClose={() => setPaymentsDrawerOpen(false)} title="All Payments">
        <div className="space-y-4 mb-6">
          {Object.entries(paymentsByItem).map(([itemTitle, itemPayments]) => (
            <div key={itemTitle}>
              <p className="text-[11px] font-semibold tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-secondary)' }}>{itemTitle}</p>
              <div className="space-y-1.5">
                {itemPayments.map(pay => (
                  <PaymentRow key={pay.id} pay={pay} cancelledTripIds={cancelledTripIds} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t pt-4" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={() => { setPaymentsDrawerOpen(false); setPayDrawerOpen(true) }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-forest)' }}
          >
            + Submit payment
          </button>
        </div>
      </Drawer>

      {/* ── Vitals full-list Drawer ─────────────────────────────────────── */}
      <Drawer open={vitalsDrawerOpen} onClose={() => setVitalsDrawerOpen(false)} title="All Vital Signs">
        <div className="space-y-2">
          {(vitalsData ?? []).map(vs => {
            const label = vs.vital_sign_definitions?.label ?? vs.definition_id
            const category = vs.vital_sign_definitions?.category
            return (
              <div key={vs.id} className="flex items-center justify-between gap-3 text-xs py-1.5">
                <div className="min-w-0">
                  <span style={{ color: 'var(--text-primary)' }}>{label}</span>
                  {category && <span className="ml-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{category}</span>}
                </div>
                <span
                  className="font-semibold px-2 py-0.5 rounded-full flex-shrink-0 text-[10px]"
                  style={{ backgroundColor: vs.recorded_at ? 'rgba(188,71,73,0.12)' : 'var(--border-default)', color: vs.recorded_at ? 'var(--brand-crimson)' : 'var(--text-secondary)' }}
                >
                  {vs.recorded_at ? '✓ Recorded' : '○ Not recorded'}
                </span>
              </div>
            )
          })}
        </div>
      </Drawer>

      {/* ── Participation full-list Drawer ──────────────────────────────── */}
      <Drawer open={participationDrawerOpen} onClose={() => setParticipationDrawerOpen(false)} title="All Participation">
        <div className="space-y-2">
          {(eventRolesData ?? []).map(er => {
            const rs = REG_STATUS_STYLES[er.status.toLowerCase()] ?? REG_STATUS_STYLES.pending
            return (
              <div key={er.id} className="flex items-start justify-between gap-3 text-xs py-1.5">
                <div className="min-w-0">
                  <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{er.calendar_events?.title ?? '—'}</p>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {er.role_label}
                    {er.calendar_events?.start_time && (
                      <span className="ml-2">{formatDate(er.calendar_events.start_time)}</span>
                    )}
                  </p>
                  {er.note && <p className="mt-0.5 italic" style={{ color: 'var(--text-secondary)' }}>{er.note}</p>}
                </div>
                <span
                  className="font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: rs.bg, color: rs.color }}
                >
                  {er.status}
                </span>
              </div>
            )
          })}
        </div>
      </Drawer>
    </div>
  )
}
