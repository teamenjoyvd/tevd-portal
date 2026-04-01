'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDate, formatCurrency } from '@/lib/format'
import { getRoleColors } from '@/lib/role-colors'
import { Drawer } from '@/components/ui/Drawer'
import { TripDocumentsTile } from './TripDocumentsTile'
import { BackButton, TripHero } from './shared'
import type { Tables } from '@/types/supabase'
import type { TripProfile, TripPayment, TeamAttendee } from '../page'

type Trip = Tables<'trips'>
type Milestone = { label: string; amount: number; due_date: string }

function SubmitPaymentDrawer({
  tripId,
  open,
  onClose,
}: {
  tripId: string
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank_transfer'>('cash')
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')

  const submitMutation = useMutation({
    mutationFn: async () => {
      let proof_url: string | null = null

      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        const uploadRes = await fetch('/api/profile/payments/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) throw new Error((await uploadRes.json()).error ?? 'Upload failed')
        const { url } = await uploadRes.json()
        proof_url = url
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          amount: parseFloat(amount),
          currency: 'EUR',
          transaction_date: date,
          payment_method: method,
          proof_url,
          note: note || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Submission failed')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-payments', tripId] })
      onClose()
      setAmount(''); setDate(''); setMethod('cash'); setFile(null); setNote('')
    },
  })

  const inputStyle = {
    backgroundColor: 'var(--bg-global)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    borderRadius: '0.75rem',
    padding: '0.625rem 0.875rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
  } as const

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    marginBottom: '0.375rem',
    color: 'var(--text-secondary)',
  } as const

  const pillBase: React.CSSProperties = {
    flex: 1,
    padding: '0.5rem 0',
    borderRadius: '0.625rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
    border: 'none',
  }

  return (
    <Drawer open={open} onClose={onClose} title="Submit Payment">
      <div className="space-y-5">
        <div>
          <label style={labelStyle}>Amount (EUR) *</label>
          <input type="number" min="0" step="0.01" placeholder="0.00"
            value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Payment Date *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Payment Method</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMethod('cash')}
              style={{
                ...pillBase,
                backgroundColor: method === 'cash' ? '#bc4749' : 'transparent',
                color: method === 'cash' ? '#ffffff' : 'var(--text-secondary)',
                border: method === 'cash' ? 'none' : '1px solid var(--border-default)',
              }}
            >
              Cash
            </button>
            <button
              type="button"
              onClick={() => setMethod('bank_transfer')}
              style={{
                ...pillBase,
                backgroundColor: method === 'bank_transfer' ? '#bc4749' : 'transparent',
                color: method === 'bank_transfer' ? '#ffffff' : 'var(--text-secondary)',
                border: method === 'bank_transfer' ? 'none' : '1px solid var(--border-default)',
              }}
            >
              Bank Transfer
            </button>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Note</label>
          <input type="text" placeholder="Optional note"
            value={note} onChange={e => setNote(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Proof of Payment</label>
          <input type="file" accept="image/*,.pdf"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            style={{ ...inputStyle, padding: '0.5rem' }} />
        </div>

        {submitMutation.isError && (
          <p className="text-xs" style={{ color: '#bc4749' }}>
            {(submitMutation.error as Error).message}
          </p>
        )}

        <button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || !amount || !date}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-forest)' }}
        >
          {submitMutation.isPending ? 'Submitting…' : 'Submit Payment'}
        </button>
      </div>
    </Drawer>
  )
}

function WhosGoingTile({ attendees }: { attendees: TeamAttendee[] }) {
  if (attendees.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="px-6 pt-5 pb-2">
        <p className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-secondary)' }}>
          Who&apos;s Going
        </p>
      </div>
      <div className="px-6 pb-5">
        {attendees.length === 0 ? (
          <p className="text-sm pt-2" style={{ color: 'var(--text-secondary)' }}>
            None of your team are registered yet.
          </p>
        ) : (
          <div className="space-y-2 mt-1">
            {attendees.map(a => {
              const colors = getRoleColors(a.role)
              return (
                <div key={a.profile_id}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
                  style={{ borderColor: 'var(--border-default)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {a.first_name} {a.last_name}
                    </p>
                    {a.abo_number && (
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {a.abo_number}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colors.bg, color: colors.font }}>
                    {a.role}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function AttendeeView({
  trip, profile, payments, teamAttendees,
}: { trip: Trip; profile: TripProfile; payments: TripPayment[]; teamAttendees: TeamAttendee[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const milestones: Milestone[] = Array.isArray(trip.milestones)
    ? (trip.milestones as Milestone[])
    : []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(trip.start_date)
  start.setHours(0, 0, 0, 0)
  const daysToGo = Math.max(0, Math.round((start.getTime() - today.getTime()) / 86400000))

  const approvedTotal = payments
    .filter(p => p.admin_status === 'approved')
    .reduce((sum, p) => sum + p.amount, 0)
  const remaining = Math.max(0, trip.total_cost - approvedTotal)

  const cumulativeMilestones = milestones.reduce<number[]>((acc, m) => {
    acc.push((acc[acc.length - 1] ?? 0) + m.amount)
    return acc
  }, [])

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[720px] mx-auto px-4 space-y-4">
        <BackButton />

        {/* Countdown header */}
        <div className="rounded-2xl px-6 py-7 flex items-center justify-between gap-4"
          style={{ backgroundColor: 'var(--brand-forest)', color: 'rgba(255,255,255,0.92)' }}>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase opacity-70 mb-1">
              {trip.destination} · {trip.title}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold leading-none">{daysToGo}</span>
              <span className="text-lg font-medium opacity-80">days to go</span>
            </div>
            <p className="text-sm opacity-60 mt-1">
              {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
            </p>
          </div>
          {daysToGo === 0 && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              Today!
            </span>
          )}
        </div>

        {/* Payment ledger */}
        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--text-secondary)' }}>
              Payment Ledger
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {formatCurrency(approvedTotal)} / {formatCurrency(trip.total_cost)}
            </p>
          </div>

          {milestones.length > 0 && (
            <div className="px-6 pb-4">
              <div className="space-y-2 mt-1">
                {milestones.map((m, i) => {
                  const covered = (cumulativeMilestones[i] ?? 0) <= approvedTotal
                  return (
                    <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0"
                      style={{ borderColor: 'var(--border-default)' }}>
                      <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: covered ? 'rgba(129,178,154,0.2)' : 'var(--border-default)',
                        }}>
                        {covered && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                            stroke="#2d6a4f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{
                          color: covered ? 'var(--text-secondary)' : 'var(--text-primary)',
                          textDecoration: covered ? 'line-through' : 'none',
                        }}>
                          {m.label}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          Due {formatDate(m.due_date)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold flex-shrink-0"
                        style={{ color: covered ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                        {formatCurrency(m.amount)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {payments.length > 0 && (
            <div className="border-t px-6 pt-4 pb-4" style={{ borderColor: 'var(--border-default)' }}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                style={{ color: 'var(--text-secondary)' }}>
                Payment History
              </p>
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-start justify-between gap-3 py-2 border-b last:border-0"
                    style={{ borderColor: 'var(--border-default)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(p.amount)}
                        </p>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={
                            p.admin_status === 'approved'
                              ? { backgroundColor: 'rgba(129,178,154,0.15)', color: '#2d6a4f' }
                              : { backgroundColor: 'rgba(180,138,60,0.12)', color: '#b48a3c' }
                          }>
                          {p.admin_status === 'approved' ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatDate(p.transaction_date)}
                        {p.payment_method ? ` · ${p.payment_method}` : ''}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    {p.proof_url && (
                      <a href={p.proof_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs flex-shrink-0 hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--brand-teal)' }}>
                        Proof ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-6 pt-3 pb-5 border-t" style={{ borderColor: 'var(--border-default)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Balance remaining
              </p>
              <p className="text-base font-semibold"
                style={{ color: remaining === 0 ? '#2d6a4f' : 'var(--text-primary)' }}>
                {remaining === 0 ? '✓ Paid in full' : formatCurrency(remaining)}
              </p>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand-forest)' }}
            >
              Submit Payment
            </button>
          </div>
        </div>

        {/* Who's Going */}
        <WhosGoingTile attendees={teamAttendees} />

        {/* Trip Documents (SEQ313) */}
        <TripDocumentsTile tripId={trip.id} />

        {/* Trip info (read-only) */}
        <TripHero trip={trip} profile={profile} />
      </div>

      <SubmitPaymentDrawer
        tripId={trip.id}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
