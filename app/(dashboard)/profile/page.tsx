'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate, formatCurrency } from '@/lib/format'

// ── LOS subtree types + components ───────────────────────────────────────────

type LOSNode = {
  profile_id: string; abo_number: string; name: string | null
  first_name: string; last_name: string; role: string
  abo_level: string | null; depth: number; sponsor_abo_number: string | null
  vital_signs: { event_key: string; event_label: string; has_ticket: boolean }[]
  children?: LOSNode[]
}

const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  admin:  { bg: '#2d332a', color: '#FAF8F3' },
  core:   { bg: '#3E7785', color: '#FAF8F3' },
  member: { bg: 'rgba(62,119,133,0.15)', color: '#3E7785' },
  guest:  { bg: 'rgba(0,0,0,0.06)', color: '#8A8577' },
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
  const rs = ROLE_STYLES[node.role] ?? ROLE_STYLES.guest
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
            style={{ backgroundColor: rs.bg, color: rs.color }}>{node.role}</span>
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

function LOSBox({ profileId }: { profileId: string }) {
  const { data: rawNodes, isLoading } = useQuery<LOSNode[]>({
    queryKey: ['los-subtree', profileId],
    queryFn: () => fetch('/api/los/tree').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  // Guard: API may return an error object instead of an array
  const flatNodes: LOSNode[] = Array.isArray(rawNodes) ? rawNodes : []
  const root = buildSubtree(flatNodes, profileId)

  if (isLoading) return (
    <div style={{ gridColumn: 'span 8' }}>
      <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
      </div>
    </div>
  )
  if (!root && !isLoading) return null

  return (
    <div style={{ gridColumn: 'span 8' }}>
      <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4" style={{ color: 'var(--brand-crimson)' }}>
          My Team
        </p>
        {root && <LOSNodeRow node={root} depth={0} />}
        {(!root || (root.children?.length ?? 0) === 0) && (
          <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            No downlines in your LOS yet.
          </p>
        )}
      </div>
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
  claimed_abo: string
  claimed_upline_abo: string
  status: 'pending' | 'approved' | 'denied'
  admin_note: string | null
  created_at: string
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

const PAYMENT_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#f2cc8f33', color: '#7a5c00' },
  completed: { bg: 'rgba(129,178,154,0.15)', color: '#2d6a4f' },
  failed:    { bg: 'rgba(188,71,73,0.10)', color: '#bc4749' },
}

const REG_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:  { bg: '#f2cc8f33', color: '#7a5c00' },
  approved: { bg: 'rgba(129,178,154,0.15)', color: '#2d6a4f' },
  denied:   { bg: 'rgba(188,71,73,0.10)', color: '#bc4749' },
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const [form, setForm] = useState<Partial<Profile>>({})
  const [saved, setSaved] = useState(false)
  const [aboInput, setAboInput] = useState('')
  const [uplineInput, setUplineInput] = useState('')
  const [calCopied, setCalCopied] = useState(false)
  const [payForm, setPayForm] = useState<Record<string, { amount: string; transaction_date: string; payment_method: string; proof_url: string; note: string }>>({})
  const [paySubmitted, setPaySubmitted] = useState<Record<string, boolean>>({})

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

  // Guard: treat missing/error API responses as no profile
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

  const { data: tripsData } = useQuery<TripEntry[]>({
    queryKey: ['profile-payments'],
    queryFn: () => fetch('/api/profile/payments').then(r => r.json()),
    enabled: !!validProfile?.id && validProfile?.role !== 'guest',
    staleTime: 2 * 60 * 1000,
  })

  const { data: vitalsData } = useQuery<VitalSign[]>({
    queryKey: ['profile-vitals'],
    queryFn: () => fetch('/api/profile/vitals').then(r => r.json()),
    enabled: !!validProfile?.id && validProfile?.role !== 'guest',
    staleTime: 5 * 60 * 1000,
  })

  const { data: eventRolesData } = useQuery<EventRoleRequest[]>({
    queryKey: ['profile-event-roles'],
    queryFn: () => fetch('/api/profile/event-roles').then(r => r.json()),
    enabled: !!validProfile?.id && validProfile?.role !== 'guest',
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
    })
  }, [validProfile])

  const saveMutation = useMutation({
    mutationFn: (body: Partial<Profile>) =>
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const submitVerification = useMutation({
    mutationFn: () =>
      fetch('/api/profile/verify-abo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimed_abo: aboInput.trim(), claimed_upline_abo: uplineInput.trim() }),
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

  const submitPayment = useMutation({
    mutationFn: ({ tripId, ...body }: { tripId: string; amount: string; transaction_date: string; payment_method: string; proof_url: string; note: string }) =>
      fetch('/api/profile/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          amount: parseFloat(body.amount),
          transaction_date: body.transaction_date,
          payment_method: body.payment_method || null,
          proof_url: body.proof_url || null,
          note: body.note || null,
        }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['profile-payments'] })
      setPayForm(f => ({ ...f, [vars.tripId]: { amount: '', transaction_date: '', payment_method: '', proof_url: '', note: '' } }))
      setPaySubmitted(f => ({ ...f, [vars.tripId]: true }))
      setTimeout(() => setPaySubmitted(f => ({ ...f, [vars.tripId]: false })), 3000)
    },
  })

  const activeDocType = form.document_active_type ?? validProfile?.document_active_type ?? 'id'
  const expiryState   = getExpiryState(form.valid_through ?? validProfile?.valid_through ?? null)
  const isGuest       = validProfile?.role === 'guest' && !validProfile?.abo_number
  const isUnverified  = validProfile?.role === 'guest' &&
    !!verRequest && (verRequest.status === 'pending' || verRequest.status === 'denied')
  const isCore        = validProfile?.role === 'core' || validProfile?.role === 'admin'

  const hasTrips = Array.isArray(tripsData) && tripsData.length > 0
  const hasVitals = Array.isArray(vitalsData) && vitalsData.length > 0
  const hasEventRoles = Array.isArray(eventRolesData) && eventRolesData.length > 0
  const hasEventActivity = hasVitals || hasEventRoles

  // ── Calendar subscription markup (shared) ───────────────────────────
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
                    <button
                      onClick={() => saveMutation.mutate({ first_name: form.first_name, last_name: form.last_name })}
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
                        {t('profile.verifPending')}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#7a5c00' }}>
                        ABO {verRequest.claimed_abo} · Upline {verRequest.claimed_upline_abo}
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
                        disabled={submitVerification.isPending || !aboInput || !uplineInput}
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
              {/* ── BENTO A: Identity ──────────────────────────────────────── */}

              {/* col-4: Names + ABO + Upline */}
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
                    {validProfile.abo_number && (
                      <div className="space-y-1">
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          ABO —{' '}
                          <span className="font-medium font-mono" style={{ color: 'var(--text-primary)' }}>
                            {validProfile.abo_number}
                          </span>
                        </p>
                        {uplineData?.upline_abo_number && (
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Upline —{' '}
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {uplineData.upline_name ?? uplineData.upline_abo_number}
                            </span>
                            {uplineData.upline_name && (
                              <span className="font-mono ml-1 opacity-60">{uplineData.upline_abo_number}</span>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* col-4: ABO status card */}
              <div style={{ gridColumn: 'span 4' }}>
                <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6" style={{ color: 'var(--brand-crimson)' }}>
                    {t('profile.aboVerification')}
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          backgroundColor: validProfile.role === 'admin' ? '#2d332a'
                            : validProfile.role === 'core' ? '#3E7785'
                            : 'rgba(62,119,133,0.15)',
                          color: validProfile.role === 'admin' ? '#FAF8F3'
                            : validProfile.role === 'core' ? '#FAF8F3'
                            : '#3E7785',
                        }}
                      >
                        {isUnverified ? 'Unverified' : ROLE_LABELS[validProfile.role]}
                      </span>
                    </div>
                    {validProfile.abo_number && (
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        ABO —{' '}
                        <span className="font-medium font-mono" style={{ color: 'var(--text-primary)' }}>
                          {validProfile.abo_number}
                        </span>
                      </p>
                    )}
                    {uplineData?.upline_abo_number && (
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Upline —{' '}
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {uplineData.upline_name ?? uplineData.upline_abo_number}
                        </span>
                        {uplineData.upline_name && (
                          <span className="font-mono ml-1 opacity-60">{uplineData.upline_abo_number}</span>
                        )}
                      </p>
                    )}
                    {ROLE_DESCRIPTIONS[validProfile.role] && (
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {ROLE_DESCRIPTIONS[validProfile.role]}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── BENTO B: Documents + Contact ────────────────────────────── */}

              {/* col-4: Identification */}
              <div style={{ gridColumn: 'span 4' }}>
                <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6" style={{ color: 'var(--brand-crimson)' }}>
                    {t('profile.travelDoc')}
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                        Document type
                      </label>
                      <select
                        value={form.document_active_type ?? activeDocType}
                        onChange={e => setForm(f => ({ ...f, document_active_type: e.target.value as 'id' | 'passport' }))}
                        className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                        style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
                      >
                        <option value="id">{t('profile.nationalId')}</option>
                        <option value="passport">{t('profile.passport')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                        {activeDocType === 'passport' ? t('profile.passportNumber') : t('profile.idNumber')}
                      </label>
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
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                        {t('profile.validThrough')}
                      </label>
                      <input
                        type="date"
                        value={form.valid_through ?? ''}
                        onChange={e => setForm(f => ({ ...f, valid_through: e.target.value }))}
                        className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                        style={{ color: 'var(--text-primary)' }}
                      />
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
                </div>
              </div>

              {/* col-4: Contact details */}
              <div style={{ gridColumn: 'span 4' }}>
                <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6" style={{ color: 'var(--brand-crimson)' }}>
                    Contact
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                        Phone
                      </label>
                      <input
                        value={form.phone ?? ''}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+359 88 000 0000"
                        className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                        style={{ color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                        Contact email
                      </label>
                      <input
                        value={form.contact_email ?? ''}
                        onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                        placeholder="your@email.com"
                        className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                        style={{ color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* col-8: Save button */}
              <div style={{ gridColumn: 'span 8' }}>
                <button
                  onClick={() => saveMutation.mutate(form)}
                  disabled={saveMutation.isPending}
                  className="w-full py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.99]"
                  style={{ backgroundColor: 'var(--brand-crimson)' }}
                >
                  {saveMutation.isPending ? t('profile.saving') : saved ? t('profile.saved') : t('profile.saveChanges')}
                </button>
              </div>

              {/* ── BENTO C: My Trips + Payments (renders only if registrations exist) ── */}
              {hasTrips && (
                <div style={{ gridColumn: 'span 8' }}>
                  <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6" style={{ color: 'var(--brand-crimson)' }}>
                      My Trips
                    </p>
                    <div className="space-y-6">
                      {tripsData!.map(entry => {
                        if (!entry.trip) return null
                        const regStyle = REG_STATUS_STYLES[entry.registration_status] ?? REG_STATUS_STYLES.pending
                        const pf = payForm[entry.trip.id] ?? { amount: '', transaction_date: '', payment_method: '', proof_url: '', note: '' }
                        return (
                          <div key={entry.registration_id} style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
                            {/* Trip header */}
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                  {entry.trip.title}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                  {entry.trip.destination} · {formatDate(entry.trip.start_date)} – {formatDate(entry.trip.end_date)}
                                </p>
                              </div>
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: regStyle.bg, color: regStyle.color }}
                              >
                                {entry.registration_status}
                              </span>
                            </div>

                            {/* Payment history */}
                            {entry.payments.length > 0 && (
                              <div className="space-y-2 mb-4">
                                {entry.payments.map(p => {
                                  const ps = PAYMENT_STATUS_STYLES[p.status] ?? PAYMENT_STATUS_STYLES.pending
                                  return (
                                    <div key={p.id} className="flex items-center gap-3 text-xs rounded-xl px-3 py-2"
                                      style={{ backgroundColor: 'var(--bg-global)' }}>
                                      <span className="font-semibold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                                        {formatCurrency(p.amount, entry.trip!.currency)}
                                      </span>
                                      <span style={{ color: 'var(--text-secondary)' }}>{formatDate(p.transaction_date)}</span>
                                      {p.payment_method && (
                                        <span style={{ color: 'var(--text-secondary)' }}>{p.payment_method}</span>
                                      )}
                                      <span
                                        className="ml-auto font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: ps.bg, color: ps.color }}
                                      >
                                        {p.status}
                                      </span>
                                      {p.proof_url && (
                                        <a href={p.proof_url} target="_blank" rel="noopener noreferrer"
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
                            )}

                            {/* Submit payment form */}
                            <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--bg-global)', border: '1px solid var(--border-default)' }}>
                              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
                                Submit payment
                              </p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Amount ({entry.trip.currency})</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={pf.amount}
                                    onChange={e => setPayForm(f => ({ ...f, [entry.trip!.id]: { ...pf, amount: e.target.value } }))}
                                    className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm"
                                    style={{ color: 'var(--text-primary)' }}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Date</label>
                                  <input
                                    type="date"
                                    value={pf.transaction_date}
                                    onChange={e => setPayForm(f => ({ ...f, [entry.trip!.id]: { ...pf, transaction_date: e.target.value } }))}
                                    className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm"
                                    style={{ color: 'var(--text-primary)' }}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Payment method</label>
                                <input
                                  value={pf.payment_method}
                                  onChange={e => setPayForm(f => ({ ...f, [entry.trip!.id]: { ...pf, payment_method: e.target.value } }))}
                                  placeholder="e.g. bank transfer, cash"
                                  className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm"
                                  style={{ color: 'var(--text-primary)' }}
                                />
                              </div>
                              <div>
                                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Proof URL (receipt / screenshot link)</label>
                                <input
                                  value={pf.proof_url}
                                  onChange={e => setPayForm(f => ({ ...f, [entry.trip!.id]: { ...pf, proof_url: e.target.value } }))}
                                  placeholder="https://"
                                  className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm"
                                  style={{ color: 'var(--text-primary)' }}
                                />
                              </div>
                              <div>
                                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Note</label>
                                <textarea
                                  value={pf.note}
                                  onChange={e => setPayForm(f => ({ ...f, [entry.trip!.id]: { ...pf, note: e.target.value } }))}
                                  rows={2}
                                  className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm resize-none"
                                  style={{ color: 'var(--text-primary)' }}
                                />
                              </div>
                              {submitPayment.isError && submitPayment.variables?.tripId === entry.trip.id && (
                                <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>
                                  {(submitPayment.error as Error).message}
                                </p>
                              )}
                              <button
                                onClick={() => submitPayment.mutate({ tripId: entry.trip!.id, ...pf })}
                                disabled={submitPayment.isPending || !pf.amount || !pf.transaction_date}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: 'var(--brand-forest)' }}
                              >
                                {paySubmitted[entry.trip.id] ? 'Submitted ✓' : submitPayment.isPending && submitPayment.variables?.tripId === entry.trip.id ? 'Submitting…' : 'Submit payment'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── BENTO D: Event Activity (renders only if data exists) ──── */}
              {hasEventActivity && (
                <div style={{ gridColumn: 'span 8' }}>
                  <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6" style={{ color: 'var(--brand-crimson)' }}>
                      Event Activity
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '12px' }}>

                      {/* col-4: Vital Signs */}
                      {hasVitals && (
                        <div style={{ gridColumn: 'span 4' }}>
                          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
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
                      )}

                      {/* col-4: Event Role Requests */}
                      {hasEventRoles && (
                        <div style={{ gridColumn: hasVitals ? 'span 4' : 'span 8' }}>
                          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
                            Role Requests
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
                      )}

                    </div>
                  </div>
                </div>
              )}

              {/* ── Calendar subscription ───────────────────────────────────── */}
              {calSubscriptionBlock}

              {/* ── LOS subtree ────────────────────────────────────────────── */}
              <LOSBox profileId={validProfile.id} />

              {/* ── Core Tools (core + admin only) ──────────────────────────── */}
              {isCore && (
                <div style={{ gridColumn: 'span 8' }}>
                  <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4" style={{ color: 'var(--brand-teal)' }}>
                      Core Tools
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
    </div>
  )
}
