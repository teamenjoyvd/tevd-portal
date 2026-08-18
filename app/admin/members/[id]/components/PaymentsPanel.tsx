import { formatDate, formatEur, STATUS_PILL } from './memberDetailFormat'

type Payment = {
  id: string; amount: number; transaction_date: string
  status: string; note: string | null
  trip: { title: string }
}

export function PaymentsPanel({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) return null
  return (
    <div className="bg-bg-card rounded-2xl border border-border-default shadow-sm p-5 mb-4">
      <p className="text-xs font-semibold tracking-widest uppercase mb-3"
        style={{ color: 'var(--text-secondary)' }}>
        Payment history
      </p>
      <div className="space-y-2">
        {payments.map(p => (
          <div key={p.id} className="flex items-center justify-between py-2 border-b border-border-default last:border-0">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {p.trip.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {formatDate(p.transaction_date)}
                {p.note && ` · ${p.note}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatEur(p.amount)}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_PILL[p.status] ?? ''}`}>
                {p.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
