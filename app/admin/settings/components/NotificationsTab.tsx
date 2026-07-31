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
      {/* Card-stack under md, grid at md+ — mirrors EmailLogTable.tsx:164-183.
          The old markup was a 6-col whitespace-nowrap table whose
          overflow-x-auto sat inside an overflow-hidden parent, so at 390px it
          overflowed and could not be scrolled. */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
        <div
          className="hidden md:grid md:grid-cols-[auto_auto_1fr_1fr_auto_auto] gap-4 px-4 py-3 text-xs font-semibold tracking-widest uppercase"
          style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-default)' }}
        >
          <span>{t('admin.notifications.col.created', 'en')}</span>
          <span>{t('admin.notifications.col.type', 'en')}</span>
          <span>{t('admin.notifications.col.title', 'en')}</span>
          <span>{t('admin.notifications.col.member', 'en')}</span>
          <span>{t('admin.notifications.col.read', 'en')}</span>
          <span>{t('admin.notifications.col.deleted', 'en')}</span>
        </div>

        {rows.map((row, i) => {
          const memberName = row.profiles
            ? `${row.profiles.first_name} ${row.profiles.last_name}`
            : '—'
          const isDeleted = !!row.deleted_at
          return (
            <div
              key={row.id}
              className="px-4 py-3 text-sm flex flex-col md:grid md:grid-cols-[auto_auto_1fr_1fr_auto_auto] md:items-center gap-1.5 md:gap-4"
              style={{
                backgroundColor: isDeleted ? 'rgba(188,71,73,0.04)' : i % 2 === 0 ? 'white' : 'var(--bg-global)',
                borderTop: i > 0 ? '1px solid var(--border-default)' : 'none',
                opacity: isDeleted ? 0.7 : 1,
              }}
            >
              <span className="text-xs md:whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                {formatDateTime(row.created_at)}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full w-fit"
                style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>{row.type}</span>
              <span className="truncate" style={{ color: 'var(--text-primary)' }}>{row.title}</span>
              <span className="truncate md:whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{memberName}</span>
              {row.is_read ? (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full w-fit"
                  style={{ backgroundColor: 'rgba(45,51,42,0.08)', color: 'var(--brand-forest)' }}>{t('admin.notifications.badge.read', 'en')}</span>
              ) : (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full w-fit"
                  style={{ backgroundColor: 'rgba(188,71,73,0.10)', color: 'var(--brand-crimson)' }}>{t('admin.notifications.badge.unread', 'en')}</span>
              )}
              {/* Deleted-at: hidden on mobile when absent — without the column
                  header there it would read as a second, unexplained date. */}
              <span
                className={`text-xs md:whitespace-nowrap ${row.deleted_at ? '' : 'hidden md:inline'}`}
                style={{ color: 'var(--text-secondary)' }}
              >
                {row.deleted_at ? formatDateTime(row.deleted_at) : '—'}
              </span>
            </div>
          )
        })}

        {rows.length === 0 && (
          <p className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.notifications.empty', 'en')}</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 flex-wrap mt-6">
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
