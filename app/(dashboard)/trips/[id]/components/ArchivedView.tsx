'use client'

import { formatDate, formatCurrency } from '@/lib/format'
import { BackButton } from './shared'
import { TripMessagesTile } from './TripMessagesTile'
import type { Tables } from '@/types/supabase'
import type { TripProfile, TripPayment } from '../page'

type Trip = Tables<'trips'>

export function ArchivedView({
  trip, profile, payments,
}: { trip: Trip; profile: TripProfile; payments: TripPayment[] }) {
  const approvedTotal = payments
    .filter(p => p.admin_status === 'approved')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[720px] mx-auto px-4 space-y-4">
        <BackButton />

        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          {trip.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={trip.image_url} alt="" aria-hidden="true"
              className="w-full object-cover" style={{ height: 200, opacity: 0.55 }} />
          )}
          <div className="px-6 pt-5 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                    {trip.destination}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'rgba(129,178,154,0.15)', color: '#2d6a4f' }}>
                    Completed
                  </span>
                </div>
                <h1 className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {trip.title}
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
                </p>
              </div>
            </div>
          </div>
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
