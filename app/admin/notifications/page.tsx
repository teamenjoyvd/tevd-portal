import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

const PAGE_SIZE = 50

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') redirect('/')

  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: rows, count, error } = await supabase
    .from('notifications')
    .select('id, created_at, type, title, is_read, deleted_at, profiles!notifications_profile_id_fkey(first_name, last_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Notification Audit Log</h1>
        <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>Error loading notifications: {error.message}</p>
      </div>
    )
  }

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  function buildUrl(p: number) {
    return `/admin/notifications?page=${p}`
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          Notification Audit Log
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          All system notifications ever fired — including soft-deleted. Read-only.
        </p>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>Created</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>Type</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>Title</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>Member</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>Read</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>Deleted</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((row, i) => {
                const profileData = row.profiles as { first_name: string; last_name: string } | null
                const memberName = profileData
                  ? `${profileData.first_name} ${profileData.last_name}`
                  : '—'
                const isDeleted = !!row.deleted_at
                return (
                  <tr
                    key={row.id}
                    style={{
                      backgroundColor: isDeleted
                        ? 'rgba(188,71,73,0.04)'
                        : i % 2 === 0 ? 'white' : 'var(--bg-global)',
                      borderBottom: '1px solid var(--border-default)',
                      opacity: isDeleted ? 0.7 : 1,
                    }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(row.created_at).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>
                      {row.title}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                      {memberName}
                    </td>
                    <td className="px-4 py-3">
                      {row.is_read ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(45,51,42,0.08)', color: 'var(--brand-forest)' }}>
                          Read
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(188,71,73,0.10)', color: 'var(--brand-crimson)' }}>
                          Unread
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {row.deleted_at
                        ? new Date(row.deleted_at).toLocaleString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
              {(rows ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No notifications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages} — {count ?? 0} total
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <a
                href={buildUrl(page - 1)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-black/5"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
              >
                ← Prev
              </a>
            )}
            {page < totalPages && (
              <a
                href={buildUrl(page + 1)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-black/5"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
              >
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
