import { formatDateTime } from '@/lib/format'
import { t } from '@/lib/i18n'

const PAGE_SIZE = 50

type NotificationRow = {
  id: string
  created_at: string
  type: string
  title: string
  is_read: boolean
  deleted_at: string | null
  profiles: { first_name: string; last_name: string } | null
}

interface NotificationsTabProps {
  rows: NotificationRow[]
  page: number
  count: number
}

export function NotificationsTab({ rows, page, count }: NotificationsTabProps) {
  const totalPages = Math.ceil(count / PAGE_SIZE)

  function buildUrl(p: number) {
    return `/admin/settings?tab=notifications&page=${p}`
  }

  return (
    <div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{t('admin.notifications.col.created', 'en')}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{t('admin.notifications.col.type', 'en')}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{t('admin.notifications.col.title', 'en')}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{t('admin.notifications.col.member', 'en')}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{t('admin.notifications.col.read', 'en')}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{t('admin.notifications.col.deleted', 'en')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const memberName = row.profiles
                  ? `${row.profiles.first_name} ${row.profiles.last_name}`
                  : '—'
                const isDeleted = !!row.deleted_at
                return (
                  <tr key={row.id} style={{
                    backgroundColor: isDeleted ? 'rgba(188,71,73,0.04)' : i % 2 === 0 ? 'white' : 'var(--bg-global)',
                    borderBottom: '1px solid var(--border-default)',
                    opacity: isDeleted ? 0.7 : 1,
                  }}>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>{row.type}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>{row.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{memberName}</td>
                    <td className="px-4 py-3">
                      {row.is_read ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(45,51,42,0.08)', color: 'var(--brand-forest)' }}>{t('admin.notifications.badge.read', 'en')}</span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(188,71,73,0.10)', color: 'var(--brand-crimson)' }}>{t('admin.notifications.badge.unread', 'en')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {row.deleted_at ? formatDateTime(row.deleted_at) : '—'}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.notifications.empty', 'en')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.notifications.pagination.info', 'en')
              .replace('{{page}}', String(page))
              .replace('{{total}}', String(totalPages))
              .replace('{{count}}', String(count))}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <a href={buildUrl(page - 1)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-black/5"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>{t('admin.notifications.pagination.prev', 'en')}</a>
            )}
            {page < totalPages && (
              <a href={buildUrl(page + 1)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-black/5"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>{t('admin.notifications.pagination.next', 'en')}</a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
