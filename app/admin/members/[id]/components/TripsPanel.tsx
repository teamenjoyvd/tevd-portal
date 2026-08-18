import { formatDate, formatEur, STATUS_PILL } from './memberDetailFormat'

type Registration = {
  id: string; status: string; created_at: string
  trip: { title: string; destination: string; start_date: string }
}

export function TripsPanel({ registrations, totalPaid }: { registrations: Registration[]; totalPaid: number }) {
  if (registrations.length === 0) return null
  return (
    <div className="bg-bg-card rounded-2xl border border-border-default shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-secondary)' }}>
          Trips
        </p>
        {totalPaid > 0 && (
          <p className="text-xs font-medium" style={{ color: 'var(--link)' }}>
            {formatEur(totalPaid)} total paid
          </p>
        )}
      </div>
      <div className="space-y-2">
        {registrations.map(r => (
          <div key={r.id} className="flex items-center justify-between py-2 border-b border-border-default last:border-0">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {r.trip.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {r.trip.destination} · {formatDate(r.trip.start_date)}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_PILL[r.status] ?? ''}`}>
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
