'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate, formatCurrency } from '@/lib/format'
import { getRoleColors } from '@/lib/role-colors'
import { Drawer } from '@/components/ui/drawer'
import { PaymentForm } from '@/components/payment/PaymentForm'
import { TripDocumentsTile } from './TripDocumentsTile'
import { TripMessagesTile } from './TripMessagesTile'
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
  const { t } = useLanguage()
  return (
    <Drawer open={open} onClose={onClose} title={t('payment.submit')}>
      <PaymentForm context="trip" tripId={tripId} onSuccess={onClose} onCancel={onClose} />
    </Drawer>
  )
}

function WhosGoingTile({ attendees }: { attendees: TeamAttendee[] }) {
  const { t } = useLanguage()
  if (attendees.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="px-6 pt-5 pb-2">
        <p className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-secondary)' }}>
          {t('trips.whosGoing')}
        </p>
      </div>
      <div className="px-6 pb-5">
        {attendees.length === 0 ? (
          <p className="text-sm pt-2" style={{ color: 'var(--text-secondary)' }}>
            {t('trips.noTeamRegistered')}
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
  const { t } = useLanguage()
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
              <span className="text-lg font-medium opacity-80">{t('trips.daysToGo')}</span>
            </div>
            <p className="text-sm opacity-60 mt-1">
              {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
            </p>
          </div>
          {daysToGo === 0 && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              {t('trips.todayBadge')}
            </span>
          )}
        </div>

        {/* Trip Messages — immediately below countdown */}
        <TripMessagesTile tripId={trip.id} />

        {/* Payment ledger */}
        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--text-secondary)' }}>
              {t('payment.ledger')}
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
                          {t('trips.due')} {formatDate(m.due_date)}
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
                {t('payment.history')}
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
                          {p.admin_status === 'approved' ? t('payment.approved') : t('payment.pending')}
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
                        {t('payment.proofLink')}
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
                {t('payment.balanceRemaining')}
              </p>
              <p className="text-base font-semibold"
                style={{ color: remaining === 0 ? '#2d6a4f' : 'var(--text-primary)' }}>
                {remaining === 0 ? t('payment.paidInFull') : formatCurrency(remaining)}
              </p>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand-forest)' }}
            >
              {t('payment.submit')}
            </button>
          </div>
        </div>

        {/* Who's Going */}
        <WhosGoingTile attendees={teamAttendees} />

        {/* Trip Documents */}
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
