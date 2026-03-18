'use client'

import Link from 'next/link'
import { useNotifications, useMarkRead } from '@/lib/hooks/useNotifications'
import { useLanguage } from '@/lib/hooks/useLanguage'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

type Props = {
  onClose: () => void
}

export default function NotificationPopup({ onClose }: Props) {
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead = useMarkRead()
  const { t } = useLanguage()

  const recent = notifications.slice(0, 5)
  const unreadCount = notifications.filter(n => !n.is_read).length

  function handleItemClick(id: string, actionUrl: string | null) {
    if (!markRead.isPending) markRead.mutate(id)
    onClose()
    if (actionUrl) window.location.href = actionUrl
  }

  return (
    <div
      className="absolute right-0 top-full mt-2 rounded-2xl z-50 flex flex-col"
      style={{
        width: 320,
        maxHeight: 420,
        backgroundColor: 'var(--bg-global)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-default)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('nav.notifications')}
        </p>
        {unreadCount > 0 && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--brand-crimson)', color: 'var(--brand-parchment)' }}
          >
            {unreadCount}
          </span>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="px-4 py-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 rounded-xl animate-pulse"
                style={{ backgroundColor: 'var(--border-default)' }} />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('notif.empty')}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {recent.map(n => (
              <button
                key={n.id}
                onClick={() => handleItemClick(n.id, n.action_url)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-black/[0.03]"
              >
                {/* Unread dot */}
                <div className="flex-shrink-0 mt-1.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: n.is_read ? 'transparent' : 'var(--brand-crimson)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm leading-snug truncate"
                    style={{
                      color: 'var(--text-primary)',
                      fontWeight: n.is_read ? 400 : 600,
                    }}
                  >
                    {n.title}
                  </p>
                  <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                    {n.message}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {timeAgo(n.created_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer — View all */}
      <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--border-default)' }}>
        <Link
          href="/notifications"
          onClick={onClose}
          className="flex items-center justify-center px-4 py-3 text-xs font-semibold tracking-wide transition-colors hover:bg-black/[0.03]"
          style={{ color: 'var(--brand-crimson)' }}
        >
          {t('notif.view')}
        </Link>
      </div>
    </div>
  )
}
