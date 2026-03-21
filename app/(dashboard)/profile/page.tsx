'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate, formatCurrency } from '@/lib/format'
import { getRoleColors } from '@/lib/role-colors'

// ── LOS subtree types + components ───────────────────────────────────────────

type LOSNode = {
  profile_id: string; abo_number: string; name: string | null
  first_name: string; last_name: string; role: string
  abo_level: string | null; depth: number; sponsor_abo_number: string | null
  vital_signs: { event_key: string; event_label: string; has_ticket: boolean }[]
  children?: LOSNode[]
}

function buildSubtree(nodes: LOSNode[], rootProfileId: string): LOSNode | null {
  const byAbo: Record<string, LOSNode> = {}
  for (const n of nodes) byAbo[n.abo_number] = { ...n, children: [] }
  for (const n of Object.values(byAbo)) {
    if (n.sponsor_abo_number && byAbo[n.sponsor_abo_number]) {
      byAbo[n.sponsor_abo_number].children!.push(n)
    }
  }
  return Object.values(byAbo).find(n => n.profile_id === rootProfileId) ?? null
}

function LOSNodeRow({ node, depth = 0 }: { node: LOSNode; depth?: number }) {
  const rc = getRoleColors(node.role)
  const displayName = node.first_name ? `${node.first_name} ${node.last_name}` : node.name ?? node.abo_number
  return (
    <div>
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
        style={{ backgroundColor: depth === 0 ? 'rgba(188,71,73,0.06)' : 'transparent' }}>
        {depth > 0 && <div className="flex-shrink-0" style={{ width: depth * 16 }} />}
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold font-body truncate" style={{ color: 'var(--text-primary)' }}>
            {displayName}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: rc.bg, color: rc.font }}>{node.role}</span>
          {node.abo_level && (
            <span className="text-[10px] font-body flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {node.abo_level}
            </span>
          )}
        </div>
        <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {node.vital_signs.map(vs => (
            <span key={vs.event_key}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: vs.has_ticket ? 'rgba(188,71,73,0.12)' : 'var(--border-default)',
                color: vs.has_ticket ? 'var(--brand-crimson)' : 'var(--text-secondary)',
              }}>
              {vs.has_ticket ? '✓' : '○'} {vs.event_label}
            </span>
          ))}
        </div>
      </div>
      {(node.children ?? []).map(child => (
        <LOSNodeRow key={child.abo_number} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

// ── Profile types ─────────────────────────────────────────────────────────────

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
  event_key: string
  event_label: string
  has_ticket: boolean
  updated_at: string
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

function getExpiryState(validThrough: string | null): 'ok' | 'warning' | 'critical' | null {
  if (!validThrough) return null
  const diffDays = (new Date(validThrough).getTime() - Date.now()) / 86400000
  if (diffDays < 0)   return 'critical'
  if (diffDays < 90)  return 'critical'
  if (diffDays < 180) return 'warning'
  return 'ok'
}

const EXPIRY_STYLES = {
  ok:       'bg-[#81b29a]/10 border-[#81b29a]/30 text-[#2d6a4f]',
  warning:  'bg-[#f2cc8f]/20 border-[#f2cc8f] text-[#7a5c00]',
  critical: 'bg-[#bc4749]/10 border-[#bc4749]/40 text-[var(--brand-crimson)]',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', core: 'Core', member: 'Member', guest: 'Guest',
}

// ── Skeleton helper ───────────────────────────────────────────────────────────

function SectionSkeleton({ height = 120 }: { height?: number }) {
  return (
    <div style={{ gridColumn: 'span 8' }}>
      <div
        className="rounded-2xl animate-pulse"
        style={{ height, backgroundColor: 'var(--border-default)' }}
      />
    </div>
  )
}

// ── Mobile-aware col-4 bento wrapper ─────────────────────────────────────────
// On mobile: full width (bento-mobile-full overrides to 1/-1).
// On md+: span 4 via inline style (matches existing desktop layout).

function Col4Bento({ children }: { children: React.ReactNode }) {
  return (
    <div className="bento-mobile-full" style={{ gridColumn: 'span 4' }}>
      {children}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const [form, setForm] = useState<Partial<Profile>>({})
  const [saved, setSaved] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [aboInput, setAboInput] = useState('')
  const [uplineInput, setUplineInput] = useState('')
  const [verificationMode, setVerificationMode] = useState<'standard' | 'manual'>('standard')
  const [calCopied, setCalCopied] = useState(false)
  // Generic payment modal state
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payModalItemId, setPayModalItemId] = useState('')
  const [payModalAmount, setPayModalAmount] = useState('')
  const [payModalDate, setPayModalDate] = useState('')
  const [payModalMethod, setPayModalMethod] = useState('')
  const [payModalNote, setPayModalNote] = useState('')
  const [payModalFile, setPayModalFile] = useState<File | null>(null)

  const EXPIRY_LABELS = {
    ok:       t('profile.expiry.ok'),
    warning:  t('profile.expiry.warning'),
    critical: t('profile.expiry.critical'),
  }

  const ROLE_DESCRIPTIONS: Record<string, string> = {
    guest:  t('profile.role.desc.guest'),
    member: t('profile.role.desc.member'),
    core:   t('profile.role.desc.core'),
    admin:  t('profile.role.desc.admin'),
  }

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
  })

  const validProfile = profile?.id ? profile : null

  const { data: verRequest } = useQuery<VerificationRequest | null>({
    queryKey: ['verify-abo'],
    queryFn: () => fetch('/api/profile/verify-abo').then(r => r.json()),
    enabled: validProfile?.role === 'guest' && !validProfile?.abo_number,
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
    queryFn: () => fetch('/api/profile/vitals').then(r => r.json()),
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

  const regenerateCal = useMutation({
    mutationFn: () => fetch('/api/calendar/feed-token', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => refetchCal(),
  })

  useEffect(() => {
    if (validProfile) setForm({
      first_name:           validProfile.first_name,
      last_name:            validProfile.last_name,
      document_active_type: validProfile.document_active_type,
      id_number:            validProfile.id_number ?? '',
      passport_number:      validProfile.passport_number ?? '',
      valid_through:        validProfile.valid_through ?? '',
      phone:                validProfile.phone ?? '',
      contact_email:        validProfile.contact_email ?? '',
      display_names:        validProfile.display_names ?? {},
    })
  }, [validProfile])

  const saveMutation = useMutation({
    mutationFn: async (body: Partial<Profile>) => {
      const payload = {
        ...body,
        id_number:       body.id_number       || null,
        passport_number: body.passport_number || null,
        valid_through:   body.valid_through   || null,
        phone:           body.phone           || null,
        contact_email:   body.contact_email   || null,
      }
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Save failed')
      return r.json()
    },
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      setSaved(true)
      setEditMode(false)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const submitVerification = useMutation({
    mutationFn: () =>
      fetch('/api/profile/verify-abo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          verificationMode === 'manual'
            ? { request_type: 'manual', claimed_upline_abo: uplineInput.trim() }
            : { claimed_abo: aboInput.trim(), claimed_upline_abo: uplineInput.trim() }
        ),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verify-abo'] })
      setAboInput('')
      setUplineInput('')
    },
  })

  const cancelVerification = useMutation({
    mutationFn: () =>
      fetch('/api/profile/verify-abo', { method: 'DELETE' }).then(r => r.json()),
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

  const submitGenericPayment = useMutation({
    mutationFn: async () => {
      let proofUrl: string | null = null
      if (payModalFile) {
        const fd = new FormData()
        fd.append('file', payModalFile)
        const uploadRes = await fetch('/api/profile/payments/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) throw new Error('File upload failed')
        const uploadData = await uploadRes.json()
        proofUrl = uploadData.url
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
      setPayModalOpen(false)
      setPayModalItemId('')
      setPayModalAmount('')
      setPayModalDate('')
      setPayModalMethod('')
      setPayModalNote('')
      setPayModalFile(null)
    },
  })

  const activeDocType = form.document_active_type ?? validProfile?.document_active_type ?? 'id'
  const expiryState   = getExpiryState(form.valid_through ?? validProfile?.valid_through ?? null)
  const isGuest       = validProfile?.role === 'guest' && !validProfile?.abo_number
  const isUnverified  = validProfile?.role === 'guest' &&
    !!verRequest && (verRequest.status === 'pending' || verRequest.status === 'denied')
  const isAdmin       = validProfile?.role === 'admin'

  const hasTrips = Array.isArray(tripsData) && tripsData.length > 0
  const hasVitals = Array.isArray(vitalsData) && vitalsData.length > 0
  const hasEventRoles = Array.isArray(eventRolesData) && eventRolesData.length > 0

  // BG name helpers
  const dnMap = ((form.display_names ?? {}) as Record<string, string>)
  const bgFirst = dnMap.bg_first ?? ''
  const bgLast  = dnMap.bg_last ?? ''

  // Group generic payments by payable_item title
  const paymentsByItem: Record<string, GenericPayment[]> = {}
  for (const p of (paymentsData ?? [])) {
    const key = p.payable_items?.title ?? 'Unknown'
    if (!paymentsByItem[key]) paymentsByItem[key] = []
    paymentsByItem[key].push(p)
  }

  // Collect cancelled trip IDs for payment flagging
  const cancelledTripIds = new Set(
    (tripsData ?? []).filter(e => e.cancelled_at).map(e => e.trip?.id).filter(Boolean) as string[]
  )

  // ── Calendar subscription block (shared) ────────────────────────
  const calSubscriptionBlock = (
    <div style={{ gridColumn: 'span 8' }}>
      <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <p className="text-xs font-semibold tracking-widest uppercase mb-1"
          style={{ color: 'var(--text-secondary)' }}>
          {t('profile.calSub')}
        </p>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {t('profile.calSubInstructions')}
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={calData?.url ?? ''}
            placeholder="Generating…"
            className="flex-1 border rounded-xl px-3 py-2 text-xs font-mono truncate"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-global)' }}
          />
          <button
            onClick={() => {
              if (calData?.url) {
                navigator.clipboard.writeText(calData.url)
                setCalCopied(true)
                setTimeout(() => setCalCopied(false), 2000)
              }
            }}
            disabled={!calData?.url}
            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 hover:opacity-80 flex-shrink-0"
            style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}
          >
            {calCopied ? t('profile.calSubCopied') : t('profile.calSubCopy')}
          </button>
          <button
            onClick={() => { if (confirm('Regenerate your calendar link? Your old link will stop working.')) regenerateCal.mutate() }}
            disabled={regenerateCal.isPending}
            className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5 disabled:opacity-40 flex-shrink-0"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {t('profile.calSubRegenerate')}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[960px] mx-auto px-4">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gap: '12px',
          }}
        >
          {isLoading ? (
            <div style={{ gridColumn: 'span 8' }}>
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-48 rounded-2xl animate-pulse"
                    style={{ backgroundColor: 'var(--border-default)' }} />
                ))}
              </div>
            </div>
          ) : !validProfile ? (
            <div style={{ gridColumn: 'span 8' }}>
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Profile not set up yet
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Your account is being configured. Please try again shortly or contact an admin.
                </p>
              </div>
            </div>
          ) : isGuest ? (
            // ── GUEST LAYOUT ────────────────────────────────────────────────
            <>
              {/* col-4: Name fields */}
              <div style={{ gridColumn: 'span 4' }}>
                <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6" style={{ color: 'var(--brand-crimson)' }}>
                    {t('profile.identity')}
                  </p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                          {t('profile.firstName')}
                        </label>
                        <input
                          value={form.first_name ?? ''}
                          onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                          className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                          style={{ color: 'var(--text-primary)' }}
                        />
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                          {t('profile.lastName')}
                        </label>
                        <input
                          value={form.last_name ?? ''}
                          onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                          className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                          style={{ color: 'var(--text-primary)' }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                          {t('profile.firstName')} (БГ)
                        </label>
                        <input
                          value={bgFirst}
                          onChange={e => setForm(f => ({ ...f, display_names: { ...((f.display_names ?? {}) as Record<string,string>), bg_first: e.target.value } }))}
                          className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                          style={{ color: 'var(--text-primary)' }}
                        />
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                          {t('profile.lastName')} (БГ)
                        </label>
                        <input
                          value={bgLast}
                          onChange={e => setForm(f => ({ ...f, display_names: { ...((f.display_names ?? {}) as Record<string,string>), bg_last: e.target.value } }))}
                          className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                          style={{ color: 'var(--text-primary)' }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => saveMutation.mutate({ first_name: form.first_name, last_name: form.last_name, display_names: form.display_names })}
                      disabled={saveMutation.isPending}
                      className="w-full py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.99]"
                      style={{ backgroundColor: 'var(--brand-crimson)' }}
                    >
                      {saveMutation.isPending ? t('profile.saving') : saved ? t('profile.saved') : t('profile.saveChanges')}
                    </button>
                  </div>
                </div>
              </div>

              {/* col-4: ABO verification */}
              <div style={{ gridColumn: 'span 4' }}>
                <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', borderLeft: '4px solid var(--brand-teal)', border: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold tracking-widest uppercase mb-1"
                    style={{ color: 'var(--text-secondary)' }}>
                    {t('profile.aboVerification')}
                  </p>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                    {t('profile.aboVerifDesc')}
                  </p>
                  {verRequest?.status === 'pending' ? (
                    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: '#f2cc8f33' }}>
                      <p className="text-sm font-medium" style={{ color: '#7a5c00' }}>
                        {verRequest.request_type === 'manual' ? 'Manual verification pending' : t('profile.verifPending')}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#7a5c00' }}>
                        {verRequest.request_type === 'manual'
                          ? `Upline ${verRequest.claimed_upline_abo}`
                          : `ABO ${verRequest.claimed_abo} · Upline ${verRequest.claimed_upline_abo}`}
                      </p>
                      <button
                        onClick={() => cancelVerification.mutate()}
                        disabled={cancelVerification.isPending}
                        className="text-xs mt-2 font-medium hover:underline disabled:opacity-50"
                        style={{ color: 'var(--brand-crimson)' }}
                      >
                        {t('profile.cancelRequest')}
                      </button>
                    </div>
                  ) : verRequest?.status === 'denied' ? (
                    <div className="rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: '#bc474915' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--brand-crimson)' }}>
                        {t('profile.prevDenied')}
                      </p>
                      {verRequest.admin_note && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--brand-crimson)' }}>
                          {verRequest.admin_note}
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {t('profile.checkDetails')}
                      </p>
                    </div>
                  ) : null}
                  {(!verRequest || verRequest.status === 'denied') && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setVerificationMode('standard')}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors"
                          style={{
                            backgroundColor: verificationMode === 'standard' ? 'var(--text-primary)' : 'transparent',
                            color: verificationMode === 'standard' ? 'var(--bg-card)' : 'var(--text-secondary)',
                            border: '1px solid var(--border-default)',
                          }}
                        >
                          I have an ABO number
                        </button>
                        <button
                          onClick={() => setVerificationMode('manual')}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors"
                          style={{
                            backgroundColor: verificationMode === 'manual' ? 'var(--text-primary)' : 'transparent',
                            color: verificationMode === 'manual' ? 'var(--bg-card)' : 'var(--text-secondary)',
                            border: '1px solid var(--border-default)',
                          }}
                        >
                          I don&apos;t have an ABO yet
                        </button>
                      </div>
                      {verificationMode === 'standard' && (
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                            {t('profile.yourAbo')}
                          </label>
                          <input
                            value={aboInput}
                            onChange={e => setAboInput(e.target.value)}
                            placeholder="e.g. 7023040472"
                            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
                            style={{ color: 'var(--text-primary)' }}
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                          {t('profile.sponsorAbo')}
                        </label>
                        <input
                          value={uplineInput}
                          onChange={e => setUplineInput(e.target.value)}
                          placeholder="e.g. 7010970187"
                          className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
                          style={{ color: 'var(--text-primary)' }}
                        />
                      </div>
                      {submitVerification.isError && (
                        <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>
                          {(submitVerification.error as Error).message}
                        </p>
                      )}
                      <button
                        onClick={() => submitVerification.mutate()}
                        disabled={submitVerification.isPending || (verificationMode === 'standard' ? (!aboInput || !uplineInput) : !uplineInput)}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: 'var(--text-primary)' }}
                      >
                        {submitVerification.isPending ? t('profile.submitting') : t('profile.submitVerif')}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* col-8: Calendar subscription */}
              {calSubscriptionBlock}
            </>
          ) : (
            // ── MEMBER / CORE / ADMIN LAYOUT ─────────────────────────────────
            <>
              {/* ── BENTO A: Personal Details (2-col internal layout) ────────── */}
              <div style={{ gridColumn: 'span 8' }}>
                <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

                  {/* Header row */}
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--brand-crimson)' }}>
                      Personal Details
                    </p>
                    {!editMode ? (
                      <button
                        onClick={() => setEditMode(true)}
                        className="text-xs font-semibold hover:opacity-70 transition-opacity px-3 py-1.5 rounded-xl border"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setEditMode(false)
                          if (validProfile) setForm({
                            first_name: validProfile.first_name,
                            last_name: validProfile.last_name,
                            document_active_type: validProfile.document_active_type,
                            id_number: validProfile.id_number ?? '',
                            passport_number: validProfile.passport_number ?? '',
                            valid_through: validProfile.valid_through ?? '',
                            phone: validProfile.phone ?? '',
                            contact_email: validProfile.contact_email ?? '',
                            display_names: validProfile.display_names ?? {},
                          })
                        }}
                        className="text-xs font-semibold hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* ── Two-column split: PERSONAL DETAILS | ABO VERIFICATION ── */}
                  <div className="flex flex-col md:flex-row gap-0">

                    {/* Left col — PERSONAL DETAILS */}
                    <div className="flex-1 space-y-4 md:pr-6">
                      <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Details
                      </p>

                      {/* EN names */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                            {t('profile.firstName')}
                          </label>
                          {editMode ? (
                            <input
                              value={form.first_name ?? ''}
                              onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                              style={{ color: 'var(--text-primary)' }}
                            />
                          ) : (
                            <p className="text-sm font-medium py-2.5" style={{ color: 'var(--text-primary)' }}>
                              {validProfile.first_name || '—'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                            {t('profile.lastName')}
                          </label>
                          {editMode ? (
                            <input
                              value={form.last_name ?? ''}
                              onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                              style={{ color: 'var(--text-primary)' }}
                            />
                          ) : (
                            <p className="text-sm font-medium py-2.5" style={{ color: 'var(--text-primary)' }}>
                              {validProfile.last_name || '—'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* BG names */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                            {t('profile.firstName')} (БГ)
                          </label>
                          {editMode ? (
                            <input
                              value={bgFirst}
                              onChange={e => setForm(f => ({ ...f, display_names: { ...((f.display_names ?? {}) as Record<string,string>), bg_first: e.target.value } }))}
                              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                              style={{ color: 'var(--text-primary)' }}
                            />
                          ) : (
                            <p className="text-sm font-medium py-2.5" style={{ color: 'var(--text-primary)' }}>
                              {bgFirst || '—'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                            {t('profile.lastName')} (БГ)
                          </label>
                          {editMode ? (
                            <input
                              value={bgLast}
                              onChange={e => setForm(f => ({ ...f, display_names: { ...((f.display_names ?? {}) as Record<string,string>), bg_last: e.target.value } }))}
                              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                              style={{ color: 'var(--text-primary)' }}
                            />
                          ) : (
                            <p className="text-sm font-medium py-2.5" style={{ color: 'var(--text-primary)' }}>
                              {bgLast || '—'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Phone + Email */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Phone</label>
                          {editMode ? (
                            <input
                              value={form.phone ?? ''}
                              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                              placeholder="+359 88 000 0000"
                              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                              style={{ color: 'var(--text-primary)' }}
                            />
                          ) : (
                            <p className="text-sm py-2.5" style={{ color: validProfile.phone ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {validProfile.phone || '—'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Contact email</label>
                          {editMode ? (
                            <input
                              value={form.contact_email ?? ''}
                              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                              placeholder="your@email.com"
                              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                              style={{ color: 'var(--text-primary)' }}
                            />
                          ) : (
                            <p className="text-sm py-2.5" style={{ color: validProfile.contact_email ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {validProfile.contact_email || '—'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Thin vertical separator — desktop only */}
                    <div
                      className="hidden md:block flex-shrink-0"
                      style={{ width: 1, backgroundColor: 'var(--border-default)', margin: '0 0' }}
                    />

                    {/* Right col — ABO VERIFICATION */}
                    <div className="flex-1 space-y-3 md:pl-6 mt-6 md:mt-0">
                      <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
                        ABO Verification
                      </p>

                      {/* Access row */}
                      {(() => {
                        const rc = getRoleColors(validProfile.role)
                        return (
                          <div className="grid grid-cols-2 gap-4">
                            <p className="text-xs py-1" style={{ color: 'var(--text-secondary)' }}>Access</p>
                            <span
                              className="text-xs font-semibold px-2.5 py-1 rounded-full self-start"
                              style={{ backgroundColor: rc.bg, color: rc.font }}
                            >
                              {isUnverified ? 'Unverified' : ROLE_LABELS[validProfile.role]}
                            </span>
                          </div>
                        )
                      })()}

                      {/* ABO # row */}
                      <div className="grid grid-cols-2 gap-4">
                        <p className="text-xs py-1" style={{ color: 'var(--text-secondary)' }}>ABO #</p>
                        {validProfile.abo_number ? (
                          <p className="text-xs font-medium font-mono py-1" style={{ color: 'var(--text-primary)' }}>
                            {validProfile.abo_number}{' '}
                            <span style={{ color: '#2d6a4f' }}>✓</span>
                          </p>
                        ) : (
                          <p className="text-xs py-1" style={{ color: 'var(--text-secondary)' }}>—</p>
                        )}
                      </div>

                      {/* Upline name row */}
                      <div className="grid grid-cols-2 gap-4">
                        <p className="text-xs py-1" style={{ color: 'var(--text-secondary)' }}>Upline</p>
                        <p className="text-xs font-medium py-1" style={{ color: 'var(--text-primary)' }}>
                          {uplineData?.upline_name ?? '—'}
                        </p>
                      </div>

                      {/* Upline number row */}
                      <div className="grid grid-cols-2 gap-4">
                        <p className="text-xs py-1" style={{ color: 'var(--text-secondary)' }}>Upline #</p>
                        <p className="text-xs font-mono py-1" style={{ color: 'var(--text-secondary)' }}>
                          {uplineData?.upline_abo_number ?? '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── Travel Document sub-section (full width, below split) ── */}
                  <>
                    <div style={{ borderTop: '1px solid var(--border-default)', margin: '20px 0 16px' }} />
                    <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4" style={{ color: 'var(--text-secondary)' }}>
                      {t('profile.travelDoc')}
                    </p>
                    <div className="space-y-4">
                      {/* Pillbox document type — muted in view mode */}
                      <div
                        style={{
                          opacity: editMode ? 1 : 0.45,
                          pointerEvents: editMode ? 'auto' : 'none',
                          transition: 'opacity 0.15s ease',
                        }}
                      >
                        <div className="flex gap-2">
                          {(['id', 'passport'] as const).map(dt => (
                            <button
                              key={dt}
                              onClick={() => setForm(f => ({ ...f, document_active_type: dt }))}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold tracking-widest uppercase transition-all"
                              style={{
                                backgroundColor: (form.document_active_type ?? activeDocType) === dt
                                  ? 'var(--text-primary)' : 'transparent',
                                color: (form.document_active_type ?? activeDocType) === dt
                                  ? 'var(--bg-card)' : 'var(--text-secondary)',
                                border: '1px solid var(--border-default)',
                                cursor: 'pointer',
                              }}
                            >
                              {dt === 'id' ? 'PERSONAL ID' : 'PASSPORT'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                            {activeDocType === 'passport' ? t('profile.passportNumber') : t('profile.idNumber')}
                          </label>
                          {editMode ? (
                            <input
                              value={activeDocType === 'passport'
                                ? (form.passport_number ?? '')
                                : (form.id_number ?? '')}
                              onChange={e => setForm(f => ({
                                ...f,
                                [activeDocType === 'passport' ? 'passport_number' : 'id_number']: e.target.value,
                              }))}
                              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
                              style={{ color: 'var(--text-primary)' }}
                            />
                          ) : (
                            <p className="text-sm font-mono py-2.5" style={{ color: 'var(--text-primary)' }}>
                              {(activeDocType === 'passport' ? validProfile.passport_number : validProfile.id_number) || '—'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                            {t('profile.validThrough')}
                          </label>
                          {editMode ? (
                            <input
                              type="date"
                              value={form.valid_through ?? ''}
                              onChange={e => setForm(f => ({ ...f, valid_through: e.target.value }))}
                              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                              style={{ color: 'var(--text-primary)' }}
                            />
                          ) : (
                            <p className="text-sm py-2.5" style={{ color: 'var(--text-primary)' }}>
                              {validProfile.valid_through ? formatDate(validProfile.valid_through) : '—'}
                            </p>
                          )}
                        </div>
                      </div>

                      {expiryState && (
                        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${EXPIRY_STYLES[expiryState]}`}>
                          {EXPIRY_LABELS[expiryState]}
                          {form.valid_through && (
                            <span className="font-normal ml-1 opacity-70">
                              · {new Date(form.valid_through).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'long', year: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </>

                  {/* Save button — edit mode only */}
                  {editMode && (
                    <button
                      onClick={() => saveMutation.mutate(form)}
                      disabled={saveMutation.isPending}
                      className="w-full mt-6 py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.99]"
                      style={{ backgroundColor: 'var(--brand-crimson)' }}
                    >
                      {saveMutation.isPending ? t('profile.saving') : saved ? t('profile.saved') : t('profile.saveChanges')}
                    </button>
                  )}
                </div>
              </div>

              {/* ── BENTO B: TRIPS [col-4 desktop, full mobile] ──────────────── */}
              {tripsLoading ? (
                <Col4Bento>
                  <div className="rounded-2xl animate-pulse" style={{ height: 160, backgroundColor: 'var(--border-default)' }} />
                </Col4Bento>
              ) : hasTrips ? (
                <Col4Bento>
                  <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4" style={{ color: 'var(--brand-crimson)' }}>
                      Trips
                    </p>
                    <div className="space-y-2">
                      {tripsData!.map(entry => {
                        if (!entry.trip) return null
                        const isCancelled = !!entry.cancelled_at
                        const regStyle = isCancelled
                          ? REG_STATUS_STYLES.cancelled
                          : (REG_STATUS_STYLES[entry.registration_status] ?? REG_STATUS_STYLES.pending)
                        return (
                          <div
                            key={entry.registration_id}
                            className="rounded-xl p-3"
                            style={{
                              backgroundColor: 'var(--bg-global)',
                              border: '1px solid var(--border-default)',
                              opacity: isCancelled ? 0.7 : 1,
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                  {entry.trip.title}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                  {entry.trip.destination}
                                </p>
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
                                onClick={() => {
                                  if (confirm('Cancel your participation in this trip? This cannot be undone.'))
                                    cancelTrip.mutate(entry.trip!.id)
                                }}
                                disabled={cancelTrip.isPending}
                                className="mt-2 text-[11px] font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
                                style={{ color: 'var(--brand-crimson)' }}
                              >
                                Cancel participation
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </Col4Bento>
              ) : null}

              {/* ── BENTO C: PAYMENTS [col-4 desktop, full mobile] ───────────── */}
              {paymentsLoading ? (
                <Col4Bento>
                  <div className="rounded-2xl animate-pulse" style={{ height: 160, backgroundColor: 'var(--border-default)' }} />
                </Col4Bento>
              ) : (
                <Col4Bento>
                  <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--brand-crimson)' }}>
                        Payments
                      </p>
                      <button
                        onClick={() => setPayModalOpen(true)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity flex-shrink-0"
                        style={{ backgroundColor: 'var(--brand-forest)' }}
                      >
                        + Submit payment
                      </button>
                    </div>
                    {Object.keys(paymentsByItem).length === 0 ? (
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No payments logged yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(paymentsByItem).map(([itemTitle, itemPayments]) => (
                          <div key={itemTitle}>
                            <p className="text-[11px] font-semibold tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                              {itemTitle}
                            </p>
                            <div className="space-y-1.5">
                              {itemPayments.map(p => {
                                const ps = PAYMENT_STATUS_STYLES[p.status] ?? PAYMENT_STATUS_STYLES.pending
                                // Check if this payment is linked to a cancelled trip via payable_item
                                const linkedTripCancelled = p.payable_items?.item_type === 'trip' &&
                                  cancelledTripIds.size > 0
                                return (
                                  <div
                                    key={p.id}
                                    className="flex items-center gap-2 text-xs rounded-xl px-3 py-2"
                                    style={{ backgroundColor: 'var(--bg-global)' }}
                                  >
                                    <span className="font-semibold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                                      {formatCurrency(p.amount, p.payable_items?.currency ?? 'EUR')}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary)' }}>{formatDate(p.transaction_date)}</span>
                                    {p.payment_method && (
                                      <span style={{ color: 'var(--text-secondary)' }}>{p.payment_method}</span>
                                    )}
                                    <span
                                      className="ml-auto font-semibold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
                                      style={{ backgroundColor: ps.bg, color: ps.color }}
                                    >
                                      {p.status}
                                      {(p.admin_note || linkedTripCancelled) && (
                                        <span
                                          title={linkedTripCancelled ? 'Trip was cancelled' : (p.admin_note ?? '')}
                                          style={{ cursor: 'help', fontSize: 10, lineHeight: 1 }}
                                        >
                                          ⓘ
                                        </span>
                                      )}
                                    </span>
                                    {p.proof_url && (
                                      <a
                                        href={p.proof_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 hover:underline"
                                        style={{ color: 'var(--brand-teal)' }}
                                      >
                                        proof ↗
                                      </a>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Col4Bento>
              )}

              {/* ── BENTO D: Vital Signs [col-4 desktop, full mobile] ────────── */}
              {vitalsLoading ? (
                <Col4Bento>
                  <div className="rounded-2xl animate-pulse" style={{ height: 120, backgroundColor: 'var(--border-default)' }} />
                </Col4Bento>
              ) : hasVitals ? (
                <Col4Bento>
                  <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6" style={{ color: 'var(--brand-crimson)' }}>
                      Vital Signs
                    </p>
                    <div className="space-y-2">
                      {vitalsData!.map(vs => (
                        <div key={vs.id} className="flex items-center justify-between gap-3 text-xs py-1.5">
                          <span style={{ color: 'var(--text-primary)' }}>{vs.event_label}</span>
                          <span
                            className="font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: vs.has_ticket ? 'rgba(188,71,73,0.12)' : 'var(--border-default)',
                              color: vs.has_ticket ? 'var(--brand-crimson)' : 'var(--text-secondary)',
                            }}
                          >
                            {vs.has_ticket ? '✓ Ticketed' : '○ No ticket'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Col4Bento>
              ) : null}

              {/* ── BENTO E: Participation [col-4 desktop, full mobile] ──────── */}
              {eventRolesLoading ? (
                <Col4Bento>
                  <div className="rounded-2xl animate-pulse" style={{ height: 120, backgroundColor: 'var(--border-default)' }} />
                </Col4Bento>
              ) : hasEventRoles ? (
                <Col4Bento>
                  <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6" style={{ color: 'var(--brand-crimson)' }}>
                      Participation
                    </p>
                    <div className="space-y-2">
                      {eventRolesData!.map(er => {
                        const rs = REG_STATUS_STYLES[er.status.toLowerCase()] ?? REG_STATUS_STYLES.pending
                        return (
                          <div key={er.id} className="flex items-start justify-between gap-3 text-xs py-1.5">
                            <div className="min-w-0">
                              <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {er.calendar_events?.title ?? '—'}
                              </p>
                              <p style={{ color: 'var(--text-secondary)' }}>{er.role_label}</p>
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
                  </div>
                </Col4Bento>
              ) : null}

              {/* ── BENTO F: Calendar subscription ─────────────────────────── */}
              {calSubscriptionBlock}

              {/* ── BENTO G: STATS ──────────────────────────────────────────── */}
              {validProfile.abo_number && (
                losSummaryLoading ? (
                  <SectionSkeleton height={80} />
                ) : (
                  <div style={{ gridColumn: 'span 8' }}>
                    <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4" style={{ color: 'var(--brand-crimson)' }}>
                        STATS
                      </p>
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Role</p>
                          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            {ROLE_LABELS[validProfile.role]}
                          </p>
                        </div>
                        {losSummary?.depth !== null && losSummary?.depth !== undefined && (
                          <div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Depth</p>
                            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                              Level {losSummary.depth}
                            </p>
                          </div>
                        )}
                        {losSummary && (
                          <div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Direct downlines</p>
                            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                              {losSummary.direct_downline_count}
                            </p>
                          </div>
                        )}
                        <a
                          href="/los"
                          className="ml-auto px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-80 transition-opacity flex-shrink-0"
                          style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}
                        >
                          VIEW LOS
                        </a>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* ── BENTO H: Admin Tools (admin only) ──────────────────────── */}
              {isAdmin && (
                <div style={{ gridColumn: 'span 8' }}>
                  <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4" style={{ color: 'var(--brand-teal)' }}>
                      Admin Tools
                    </p>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                        gap: '12px',
                      }}
                    >
                      <a
                        href="/admin"
                        style={{
                          gridColumn: 'span 2',
                          backgroundColor: 'var(--brand-forest)',
                          color: 'var(--brand-parchment)',
                        }}
                        className="rounded-xl px-4 py-3 flex flex-col gap-1 hover:opacity-80 transition-opacity"
                      >
                        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--brand-parchment)' }}>Admin</span>
                        <span className="text-[10px] opacity-60" style={{ color: 'var(--brand-parchment)' }}>Portal management</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── PAYMENT MODAL (fixed, blocking, non-backdrop-dismissable) ─────── */}
      {payModalOpen && (
        <>
          {/* Backdrop — intentionally no onClick: user must Cancel or Submit */}
          <div
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          {/* Modal — viewport-safe on all screen sizes */}
          <div
            className="fixed z-[51] rounded-2xl shadow-xl p-6"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              maxWidth: 'min(28rem, calc(100vw - 2rem))',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
            }}
          >
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Submit Payment
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Item</label>
                <select
                  value={payModalItemId}
                  onChange={e => setPayModalItemId(e.target.value)}
                  className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm"
                  style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
                >
                  <option value="">Select an item…</option>
                  {(payableItems ?? []).map(item => (
                    <option key={item.id} value={item.id}>
                      {item.title} — {formatCurrency(item.amount, item.currency)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payModalAmount}
                    onChange={e => setPayModalAmount(e.target.value)}
                    className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Date</label>
                  <input
                    type="date"
                    value={payModalDate}
                    onChange={e => setPayModalDate(e.target.value)}
                    className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Payment method</label>
                <input
                  value={payModalMethod}
                  onChange={e => setPayModalMethod(e.target.value)}
                  placeholder="e.g. bank transfer, cash"
                  className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Proof of payment (optional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => setPayModalFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                />
                {payModalFile && (
                  <p className="text-[11px] mt-1" style={{ color: 'var(--brand-teal)' }}>
                    {payModalFile.name}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Note</label>
                <textarea
                  value={payModalNote}
                  onChange={e => setPayModalNote(e.target.value)}
                  rows={2}
                  className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm resize-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              {submitGenericPayment.isError && (
                <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>
                  {(submitGenericPayment.error as Error).message}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => {
                    setPayModalOpen(false)
                    setPayModalItemId('')
                    setPayModalAmount('')
                    setPayModalDate('')
                    setPayModalMethod('')
                    setPayModalNote('')
                    setPayModalFile(null)
                    submitGenericPayment.reset()
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-black/5 transition-colors"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => submitGenericPayment.mutate()}
                  disabled={submitGenericPayment.isPending || !payModalItemId || !payModalAmount || !payModalDate}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--brand-forest)' }}
                >
                  {submitGenericPayment.isPending ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
