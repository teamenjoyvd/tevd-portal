'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { toast } from '@/lib/toast'

// ── Types ──────────────────────────────────────────────────────────────────────

type OutboundRequest = {
  id: string
  status: string
  admin_note: string | null
  created_at: string
  claimed_primary: { first_name: string; last_name: string; abo_number: string | null } | null
}

type InboundRequest = {
  id: string
  status: string
  created_at: string
  requester: { id: string; first_name: string; last_name: string; contact_email: string | null } | null
}

type Props = {
  profileRole: string
  isPrimary: boolean
  outboundRequest: OutboundRequest | null
  inboundRequests: InboundRequest[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fullName(p: { first_name: string; last_name: string } | null) {
  if (!p) return '—'
  return `${p.first_name} ${p.last_name}`.trim()
}

// ── DenyForm ──────────────────────────────────────────────────────────────────

function DenyForm({
  onCancel,
  onConfirm,
  isPending,
}: {
  onCancel: () => void
  onConfirm: (note: string) => void
  isPending: boolean
}) {
  const [note, setNote] = useState('')
  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Reason for denying (required)"
        rows={2}
        className="w-full text-xs rounded-xl border px-3 py-2 resize-none focus:outline-none"
        style={{
          backgroundColor: 'var(--bg-global)',
          borderColor: 'var(--border-default)',
          color: 'var(--text-primary)',
        }}
      />
      <div className="flex gap-2">
        <button
          onClick={() => { if (note.trim()) onConfirm(note.trim()) }}
          disabled={!note.trim() || isPending}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          Confirm deny
        </button>
        <button
          onClick={onCancel}
          disabled={isPending}
          className="px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── PrimaryView ────────────────────────────────────────────────────────────────

function PrimaryView({ inboundRequests }: { inboundRequests: InboundRequest[] }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [denyingId, setDenyingId] = useState<string | null>(null)

  const actionMutation = useMutation({
    mutationFn: ({ requestId, action, deny_note }: { requestId: string; action: 'approve' | 'deny'; deny_note?: string }) =>
      fetch(`/api/profile/spouse-link/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, deny_note }),
      }).then(async r => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`)
        return body
      }),
    onSuccess: (_data, vars) => {
      setDenyingId(null)
      toast.success(vars.action === 'approve' ? 'Spouse link approved.' : 'Request denied.')
      qc.invalidateQueries({ queryKey: ['profile'] })
      // Refresh RSC page data without resetting client state
      router.refresh()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Action failed. Please try again.')
    },
  })

  if (inboundRequests.length === 0) {
    return (
      <div
        className="rounded-2xl border px-5 py-8 text-center"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No pending spouse link requests.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {inboundRequests.map(req => (
        <div
          key={req.id}
          className="rounded-2xl border px-5 py-4"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
            {fullName(req.requester)}
          </p>
          {req.requester?.contact_email && (
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>
              {req.requester.contact_email}
            </p>
          )}
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            Submitted {formatDate(req.created_at)}
          </p>

          {denyingId !== req.id ? (
            <div className="flex gap-2">
              <button
                onClick={() => actionMutation.mutate({ requestId: req.id, action: 'approve' })}
                disabled={actionMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: 'var(--brand-teal)' }}
              >
                Approve
              </button>
              <button
                onClick={() => setDenyingId(req.id)}
                disabled={actionMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
              >
                Deny
              </button>
            </div>
          ) : (
            <DenyForm
              onCancel={() => setDenyingId(null)}
              onConfirm={note => actionMutation.mutate({ requestId: req.id, action: 'deny', deny_note: note })}
              isPending={actionMutation.isPending}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── GuestView ──────────────────────────────────────────────────────────────────

function GuestView({ outboundRequest }: { outboundRequest: OutboundRequest | null }) {
  if (!outboundRequest) {
    return (
      <div
        className="rounded-2xl border px-5 py-8 text-center"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          You have no active spouse link request.
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Submit one from your Profile page.
        </p>
      </div>
    )
  }

  const isPending = outboundRequest.status === 'pending'
  const isDenied  = outboundRequest.status === 'denied'

  return (
    <div
      className="rounded-2xl border px-5 py-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: isPending ? 'rgba(0,0,0,0.08)' : isDenied ? 'var(--brand-crimson)' : 'var(--border-default)',
      }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold mb-3"
        style={{
          backgroundColor: isPending ? '#f2cc8f33' : isDenied ? '#bc474915' : '#1a3c2e18',
          color: isPending ? '#7a5c00' : isDenied ? '#bc4749' : '#1a3c2e',
        }}
      >
        {isPending ? 'Pending primary review' : isDenied ? 'Denied' : 'Approved'}
      </div>
      <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
        {fullName(outboundRequest.claimed_primary)}
        {outboundRequest.claimed_primary?.abo_number && (
          <span className="font-normal text-xs ml-1.5" style={{ color: 'var(--text-secondary)' }}>
            ABO {outboundRequest.claimed_primary.abo_number}
          </span>
        )}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Submitted {formatDate(outboundRequest.created_at)}
      </p>
      {isDenied && outboundRequest.admin_note && (
        <p className="text-xs mt-2" style={{ color: 'var(--brand-crimson)' }}>
          {outboundRequest.admin_note}
        </p>
      )}
      {isPending && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
          Waiting for {fullName(outboundRequest.claimed_primary)} to review your request.
        </p>
      )}
    </div>
  )
}

// ── Page component ─────────────────────────────────────────────────────────────

export default function SpouseLinkClient({
  profileRole,
  isPrimary,
  outboundRequest,
  inboundRequests,
}: Props) {
  const { t } = useLanguage()
  void t

  const isGuest = profileRole === 'guest'
  const title = isGuest ? 'Your spouse link request' : 'Spouse link requests'
  const subtitle = isGuest
    ? 'Track the status of your request to link as a spouse account.'
    : 'Review and approve or deny requests from guests claiming to be your spouse.'

  const content = (
    <>
      <div
        style={{
          borderRadius: 'var(--bento-radius)',
          padding: 'var(--bento-padding)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          marginBottom: 12,
        }}
      >
        <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-1" style={{ color: 'var(--brand-crimson)' }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      </div>

      {isGuest ? (
        <GuestView outboundRequest={outboundRequest} />
      ) : isPrimary ? (
        <PrimaryView inboundRequests={inboundRequests} />
      ) : (
        <div
          className="rounded-2xl border px-5 py-8 text-center"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            This page is not available for secondary accounts.
          </p>
        </div>
      )}
    </>
  )

  return (
    <div className="py-8 pb-16">

      {/* ── DESKTOP ─────────────────────────────────────────────────────────── */}
      <div className="hidden md:block max-w-[860px] mx-auto px-4">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: '12px',
          }}
        >
          <div style={{ gridColumn: '3 / span 8' }}>
            {content}
          </div>
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col gap-3 px-4">
        {content}
      </div>

    </div>
  )
}
