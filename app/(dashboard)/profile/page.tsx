'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'

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
  const { data: flatNodes = [], isLoading } = useQuery<LOSNode[]>({
    queryKey: ['los-subtree', profileId],
    queryFn: () => fetch('/api/los/tree').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

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
}

type VerificationRequest = {
  id: string
  claimed_abo: string
  claimed_upline_abo: string
  status: 'pending' | 'approved' | 'denied'
  admin_note: string | null
  created_at: string
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

  const { data: verRequest } = useQuery<VerificationRequest | null>({
    queryKey: ['verify-abo'],
    queryFn: () => fetch('/api/profile/verify-abo').then(r => r.json()),
    enabled: profile?.role === 'guest' && !profile?.abo_number,
  })

  const { data: calData, refetch: refetchCal } = useQuery<{ url: string }>({
    queryKey: ['cal-feed-token'],
    queryFn: () => fetch('/api/calendar/feed-token').then(r => r.json()),
    enabled: !!profile,
    staleTime: Infinity,
  })

  const regenerateCal = useMutation({
    mutationFn: () => fetch('/api/calendar/feed-token', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => refetchCal(),
  })

  useEffect(() => {
    if (profile) setForm({
      first_name:           profile.first_name,
      last_name:            profile.last_name,
      document_active_type: profile.document_active_type,
      id_number:            profile.id_number ?? '',
      passport_number:      profile.passport_number ?? '',
      valid_through:        profile.valid_through ?? '',
    })
  }, [profile])

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

  const toggleDoc = useMutation({
    mutationFn: (type: 'id' | 'passport') =>
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_active_type: type }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      setForm(f => ({ ...f, document_active_type: data.document_active_type }))
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

  const activeDocType = form.document_active_type ?? profile?.document_active_type ?? 'id'
  const expiryState   = getExpiryState(form.valid_through ?? profile?.valid_through ?? null)
  const isGuest       = profile?.role === 'guest' && !profile?.abo_number
  const isUnverified  = profile?.role === 'guest' &&
    !!verRequest && (verRequest.status === 'pending' || verRequest.status === 'denied')
  const isCore        = profile?.role === 'core' || profile?.role === 'admin'

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
          ) : !profile ? null : (
            <>
              {/* ── Box 1: Personal data ──────────────────────────────────── */}
              <div style={{ gridColumn: 'span 8' }}>
                <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-6" style={{ color: 'var(--brand-crimson)' }}>
                    {t('profile.identity')}
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                      gap: '12px',
                    }}
                  >
                    {/* Identity fields — col-4 */}
                    <div style={{ gridColumn: 'span 4' }} className="space-y-4">
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
                      <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {profile.abo_number && (
                          <span>
                            ABO:{' '}
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {profile.abo_number}
                            </span>
                          </span>
                        )}
                        <span>
                          {t('profile.role')}:{' '}
                          <span
                            className="font-semibold px-2 py-0.5 rounded-full text-xs"
                            style={{
                              backgroundColor: profile.role === 'guest' ? 'rgba(0,0,0,0.06)' : '#81b29a33',
                              color: profile.role === 'guest' ? 'var(--text-secondary)' : '#2d6a4f',
                            }}
                          >
                            {isUnverified ? 'Unverified Member' : ROLE_LABELS[profile.role]}
                          </span>
                        </span>
                      </div>
                      {ROLE_DESCRIPTIONS[profile.role] && (
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {ROLE_DESCRIPTIONS[profile.role]}
                        </p>
                      )}
                    </div>

                    {/* Travel doc — col-4 */}
                    <div style={{ gridColumn: 'span 4' }} className="space-y-4">
                      <p className="text-xs font-semibold tracking-widest uppercase"
                        style={{ color: 'var(--text-secondary)' }}>
                        {t('profile.travelDoc')}
                      </p>
                      <div className="flex gap-2">
                        {(['id', 'passport'] as const).map(type => (
                          <button
                            key={type}
                            onClick={() => toggleDoc.mutate(type)}
                            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                            style={{
                              backgroundColor: activeDocType === type ? 'var(--brand-forest)' : 'rgba(0,0,0,0.05)',
                              color: activeDocType === type ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                            }}
                          >
                            {type === 'id' ? t('profile.nationalId') : t('profile.passport')}
                          </button>
                        ))}
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

                    {/* Calendar subscription — col-8 */}
                    <div
                      style={{ gridColumn: 'span 8', borderTop: '1px solid var(--border-default)', paddingTop: '20px' }}
                    >
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

                    {/* Save button — col-8 */}
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
                  </div>
                </div>
              </div>

              {/* ── ABO Verification — guests only ───────────────────────── */}
              {isGuest && (
                <div style={{ gridColumn: 'span 8' }}>
                  <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', borderLeft: '4px solid var(--brand-teal)', border: '1px solid var(--border-default)' }}>
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
              )}

              {/* ── Box 2: LOS subtree ───────────────────────────────────── */}
              <LOSBox profileId={profile.id} />

              {/* ── Box 3: Core-only apps (core + admin only) ────────────── */}
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
