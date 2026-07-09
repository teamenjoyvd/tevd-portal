import { formatDate, STATUS_PILL } from './memberDetailFormat'

type RoleRequest = {
  id: string; role_label: string; status: string; created_at: string
  event: { title: string; start_time: string }
}

export function RoleRequestsPanel({ roleRequests }: { roleRequests: RoleRequest[] }) {
  if (roleRequests.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 mb-4">
      <p className="text-xs font-semibold tracking-widest uppercase mb-3"
        style={{ color: 'var(--text-secondary)' }}>
        Event role requests
      </p>
      <div className="space-y-2">
        {roleRequests.map(r => (
          <div key={r.id} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {r.role_label} · {r.event.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {formatDate(r.event.start_time)}
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
