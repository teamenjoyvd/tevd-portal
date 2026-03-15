'use client'

import { useNotifications, useMarkRead, useMarkAllRead } from '@/lib/hooks/useNotifications'
import PageHeading from '@/components/layout/PageHeading'
import PageContainer from '@/components/layout/PageContainer'

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
    <>
      <PageHeading title="Notifications" subtitle="Your activity and alerts" />
      <PageContainer>
        <div className="max-w-2xl py-8 pb-16">

          {unreadCount > 0 && (
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm" style={{ color: 'var(--stone)' }}>
                {unreadCount} unread
              </p>
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-sm font-medium disabled:opacity-50 hover:underline"
                style={{ color: 'var(--crimson)' }}
              >
                Mark all as read
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl animate-pulse"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="var(--stone)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <p className="font-medium" style={{ color: 'var(--deep)' }}>All caught up</p>
              <p className="text-sm mt-1" style={{ color: 'var(--stone)' }}>
                No notifications yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.is_read) markRead.mutate(n.id) }}
                  className="rounded-xl p-4 border transition-colors cursor-pointer"
                  style={{
                    backgroundColor: n.is_read ? 'white' : 'rgba(244,241,222,0.6)',
                    borderColor: n.is_read
                      ? 'rgba(0,0,0,0.05)'
                      : 'rgba(224,122,95,0.25)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[n.type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {TYPE_LABELS[n.type] ?? n.type}
                        </span>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: 'var(--crimson)' }} />
                        )}
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--deep)' }}>
                        {n.title}
                      </p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--stone)' }}>
                        {n.message}
                      </p>
                    </div>
                    <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: 'var(--stone)' }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  {n.action_url && (
                    <a
                      href={n.action_url}
                      onClick={e => e.stopPropagation()}
                      className="text-xs font-medium mt-2 inline-block hover:underline"
                      style={{ color: 'var(--crimson)' }}
                    >
                      View →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </>
  )
}