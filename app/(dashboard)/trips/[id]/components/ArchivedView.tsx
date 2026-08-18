'use client'

import { useState } from 'react'
import { formatDate, formatCurrency } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { BackButton, TripHeroImage, TripDetail, FALLBACK_ACCENT } from './shared'
import { personalApprovedTotal } from '@/lib/payments/totals'
import { TripMessagesTile } from './TripMessagesTile'
import type { Tables } from '@/types/supabase'
import type { TripProfile, TripPayment } from '../page'

type Trip = Tables<'trips'>

export function ArchivedView({
  trip, profile, payments,
}: { trip: Trip; profile: TripProfile; payments: TripPayment[] }) {
  const { t } = useLanguage()
  const [accentColor, setAccentColor] = useState(FALLBACK_ACCENT)

  // Same correction as AttendeeView (2607-DEV-677): a guest row sits on the
  // payer's ledger but is not the payer's own fee, so the final "Total paid"
  // must leave it out. See lib/payments/totals.ts.
  const approvedTotal = personalApprovedTotal(payments)

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[720px] mx-auto px-4 space-y-4">
        <BackButton />

        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
          <TripHeroImage trip={trip} muted onAccentColor={setAccentColor} />
          <TripDetail trip={trip} profile={profile} accentColor={accentColor} />
        </div>

        {/* Trip Messages — between hero card and Final Ledger */}
        <TripMessagesTile tripId={trip.id} />

        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="px-6 pt-5 pb-2">
            <p className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--text-secondary)' }}>
              Final Ledger
            </p>
          </div>

          {payments.length > 0 ? (
            <div className="px-6 pb-4">
              <div className="space-y-2 mt-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-start justify-between gap-3 py-2 border-b last:border-0"
                    style={{ borderColor: 'var(--border-default)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(p.amount)}
                        </p>
                        <span className="text-xs px-1.5 py-0.5 rounded-control font-medium"
                          style={
                            p.admin_status === 'approved'
                              ? { backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-fg)' }
                              : { backgroundColor: 'var(--status-pending-bg)', color: 'var(--status-pending-fg)' }
                          }>
                          {p.admin_status === 'approved' ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatDate(p.transaction_date)}
                        {p.payment_method ? ` · ${p.payment_method}` : ''}
                        {p.note ? ` · ${p.note}` : ''}
                        {/* Says why this row is not in the total below.
                            Translated, matching the identical marker in
                            AttendeeView: an attribution the reader has to act on
                            is worth more in their own language than the status
                            literals around it, which stay English for now.
                            translate() takes no interpolation args, so the name
                            is composed here. */}
                        {p.payment_guests
                          ? ` · ${t('payment.for')} ${p.payment_guests.name} · ${t('payment.guestTag')}`
                          : ''}
                      </p>
                    </div>
                    {p.proof_url && (
                      <a href={p.proof_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs flex-shrink-0 hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--link)' }}>
                        Proof ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="px-6 pb-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              No payments recorded.
            </p>
          )}

          <div className="px-6 pt-3 pb-5 border-t flex items-center justify-between"
            style={{ borderColor: 'var(--border-default)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total paid</p>
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(approvedTotal)} / {formatCurrency(trip.total_cost)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
