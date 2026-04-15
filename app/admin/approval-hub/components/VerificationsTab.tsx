'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'

// ── Types ────────────────────────────────────────────────────────

export type VerificationRequest = {
  id: string
  profile_id: string
  claimed_abo: string | null
  claimed_upline_abo: string
  status: 'pending' | 'approved' | 'denied'
  request_type: string
  created_at: string
  profiles: { first_name: string; last_name: string } | null
}

export type GuestProfile = {
  id: string
  first_name: string
  last_name: string
  role: string
  created_at: string
}

export type ManualMemberNoAbo = {
  id: string
  first_name: string
  last_name: string
  upline_abo_number: string | null
  created_at: string
}

export type AdminMembersResponse = {
  pending_verifications: VerificationRequest[]
  unverified_guests: GuestProfile[]
  manual_members_no_abo: ManualMemberNoAbo[]
}

// ── Helpers ──────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-[#f2cc8f]/30 text-[#7a5c00] border border-[#f2cc8f]',
  approved: 'bg-[#81b29a]/20 text-[#2d6a4f] border border-[#81b29a]/50',
  denied:   'bg-[#bc4749]/10 text-[#bc4749] border border-[#bc4749]/30',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Component: ABO Verification ───────────────────────────────────

export function AboVerificationTab() {
  const qc = useQueryClient()
  const [directProfileId, setDirectProfileId] = useState('')
  const [directUpline, setDirectUpline] = useState('')
  const [directError, setDirectError] = useState<string | null>(null)
  const [directSuccess, setDirectSuccess] = useState(false)

  const { data, isLoading } = useQuery<AdminMembersResponse>({
    queryKey: ['admin-members'],
    queryFn: () => fetch('/api/admin/members').then(r => r.json()),
  })

  const pendingVerifications = data?.pending_verifications ?? []
  const standardPending = pendingVerifications.filter(v => v.request_type !== 'manual')
  const manualPending   = pendingVerifications.filter(v => v.request_type === 'manual')
  const pendingProfileIds = new Set(pendingVerifications.map(v => v.profile_id))

  const directCandidates = (data?.unverified_guests ?? []).filter(
    g => !pendingProfileIds.has(g.id)
  )

  const manualNoAbo = data?.manual_members_no_abo ?? []

  const approveOrDeny = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'deny' }) =>
      fetch(`/api/admin/members/verify/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onError: (e: Error) => {
      toast.error(e.message ?? 'Verification action failed.')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin-members'] })
    },
  })

  const directVerify = useMutation({
    mutationFn: ({ profile_id, upline_abo_number }: { profile_id: string; upline_abo_number: string }) =>
      fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id, upline_abo_number }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      setDirectProfileId('')
      setDirectUpline('')
      setDirectError(null)
      setDirectSuccess(true)
      setTimeout(() => setDirectSuccess(false), 3000)
      qc.invalidateQueries({ queryKey: ['admin-members'] })
    },
    onError: (e: Error) => {
      setDirectError(e.message)
      toast.error(e.message ?? 'Verification action failed.')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-black/5 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Standard ABO requests ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
          Standard ABO requests — {standardPending.length}
        </p>
        {standardPending.length === 0 ? (
          <div className="rounded-xl border px-5 py-6 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.approval.verify.noStandard')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {standardPending.map(v => (
              <div key={v.id} className="rounded-xl border px-4 py-3.5 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {v.profiles?.first_name} {v.profiles?.last_name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    ABO {v.claimed_abo} · Upline {v.claimed_upline_abo} · {formatDate(v.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveOrDeny.mutate({ id: v.id, action: 'approve' })}
                    disabled={approveOrDeny.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: 'var(--brand-teal)' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => approveOrDeny.mutate({ id: v.id, action: 'deny' })}
                    disabled={approveOrDeny.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Manual requests (no ABO path) ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
          Manual requests — {manualPending.length}
        </p>
        {manualPending.length === 0 ? (
          <div className="rounded-xl border px-5 py-6 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.approval.verify.noManual')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {manualPending.map(v => (
              <div key={v.id} className="rounded-xl border px-4 py-3.5 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {v.profiles?.first_name} {v.profiles?.last_name}
                    </p>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'rgba(62,119,133,0.15)', color: '#3E7785' }}
                    >
                      No ABO
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Upline {v.claimed_upline_abo} · {formatDate(v.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveOrDeny.mutate({ id: v.id, action: 'approve' })}
                    disabled={approveOrDeny.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: 'var(--brand-teal)' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => approveOrDeny.mutate({ id: v.id, action: 'deny' })}
                    disabled={approveOrDeny.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Members awaiting LOS positioning (approved manual, no ABO) ── */}
      {manualNoAbo.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
            Awaiting LOS positioning — {manualNoAbo.length}
          </p>
          <div className="space-y-2">
            {manualNoAbo.map(m => (
              <div key={m.id} className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {m.first_name} {m.last_name}
                    </p>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'rgba(62,119,133,0.15)', color: '#3E7785' }}
                    >
                      No ABO
                    </span>
                  </div>
                  {m.upline_abo_number && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      Upline {m.upline_abo_number}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE.approved}`}>
                  approved
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Direct verify (Path C) ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>
          Direct verify
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          Directly promote a guest to member without a prior submission.
        </p>
        <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.approval.verify.lbl.guest')}</label>
            <select
              value={directProfileId}
              onChange={e => setDirectProfileId(e.target.value)}
              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            >
              <option value="">{t('admin.approval.verify.opt.selectGuest')}</option>
              {directCandidates.map(g => (
                <option key={g.id} value={g.id}>
                  {g.first_name} {g.last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.approval.verify.lbl.uplineAbo')}</label>
            <input
              value={directUpline}
              onChange={e => setDirectUpline(e.target.value)}
              placeholder={t('admin.approval.verify.placeholder.upline')}
              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
          </div>
          {directError && (
            <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{directError}</p>
          )}
          <button
            onClick={() => {
              setDirectError(null)
              directVerify.mutate({ profile_id: directProfileId, upline_abo_number: directUpline.trim() })
            }}
            disabled={directVerify.isPending || !directProfileId || !directUpline.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-forest)' }}
          >
            {directVerify.isPending ? 'Verifying…' : directSuccess ? 'Verified ✓' : 'Verify member'}
          </button>
          {directCandidates.length === 0 && (
            <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
              No guests without a pending request.
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
