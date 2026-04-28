'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { VerificationList } from './VerificationList'
import { DirectVerifyForm } from './DirectVerifyForm'

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

// ── Component ────────────────────────────────────────────────────

export function AboVerificationTab() {
  const { t, lang } = useLanguage()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<AdminMembersResponse>({
    queryKey: ['admin-members'],
    queryFn: () => fetch('/api/admin/members').then(r => r.json()),
  })

  const pendingVerifications = data?.pending_verifications ?? []
  const standardPending = pendingVerifications.filter(v => v.request_type !== 'manual')
  const manualPending   = pendingVerifications.filter(v => v.request_type === 'manual')
  const pendingProfileIds = new Set(pendingVerifications.map(v => v.profile_id))
  const directCandidates = (data?.unverified_guests ?? []).filter(g => !pendingProfileIds.has(g.id))
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
    onError: (e: Error) => { toast.error(e.message ?? 'Verification action failed.') },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['admin-members'] }) },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-members'] }) },
    onError: (e: Error) => { toast.error(e.message ?? 'Verification action failed.') },
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
          {t('admin.approval.verify.standardTitle').replace('{{count}}', String(standardPending.length))}
        </p>
        <VerificationList
          items={standardPending}
          onApprove={id => approveOrDeny.mutate({ id, action: 'approve' })}
          onDeny={id => approveOrDeny.mutate({ id, action: 'deny' })}
          isPending={approveOrDeny.isPending}
          showNoAboBadge={false}
          emptyMessage={t('admin.approval.verify.noStandard')}
        />
      </div>

      {/* ── Manual requests ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.approval.verify.manualTitle').replace('{{count}}', String(manualPending.length))}
        </p>
        <VerificationList
          items={manualPending}
          onApprove={id => approveOrDeny.mutate({ id, action: 'approve' })}
          onDeny={id => approveOrDeny.mutate({ id, action: 'deny' })}
          isPending={approveOrDeny.isPending}
          showNoAboBadge={true}
          emptyMessage={t('admin.approval.verify.noManual')}
        />
      </div>

      {/* ── Members awaiting LOS positioning ── */}
      {manualNoAbo.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.approval.verify.awaitingPosTitle').replace('{{count}}', String(manualNoAbo.length))}
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
                      {t('admin.approval.verify.noAboBadge')}
                    </span>
                  </div>
                  {m.upline_abo_number && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      Upline {m.upline_abo_number}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE.approved}`}>
                  {t('admin.approval.verify.approvedBadge')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Direct verify (Path C) ── */}
      <DirectVerifyForm
        candidates={directCandidates}
        onSubmit={directVerify.mutateAsync}
        isPending={directVerify.isPending}
      />

    </div>
  )
}
