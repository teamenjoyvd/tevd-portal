'use client'

import { useNotifications, useMarkRead, useMarkAllRead } from '@/lib/hooks/useNotifications'

const TYPE_LABELS: Record<string, string> = {
  role_request:  'Role request',
  trip_request:  'Trip request',
  trip_created:  'New trip',
  event_fetched: 'New event',
  doc_expiry:    'Document expiry',
}

const TYPE_COLORS: Record<string, string> = {
  role_request:  'bg-blue-50 text-blue-700',
  trip_request:  'bg-purple-50 text-purple-700',
  trip_created:  'bg-green-50 text-green-700',
  event_fetched: 'bg-amber-50 text-amber-700',
  doc_expiry:    'bg-red-50 text-red-700',
}

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

export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead    = useMarkRead()
  const markAllRead = useMarkAllRead()

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-sm text-[#bc4749] hover:underline disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No notifications yet</p>
          <p className="text-sm mt-1">You&apos;re all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => { if (!n.is_read) markRead.mutate(n.id) }}
              className={`
                rounded-xl p-4 border transition-colors cursor-pointer
                ${n.is_read
                  ? 'bg-white border-gray-100'
                  : 'bg-[#f4f1de] border-[#e07a5f]/20 hover:border-[#e07a5f]/40'}
              `}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[n.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#bc4749] flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                  {timeAgo(n.created_at)}
                </span>
              </div>
              {n.action_url && (
                    <a href={n.action_url}
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-[#bc4749] hover:underline mt-2 inline-block"
                >
                  View →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}