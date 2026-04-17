'use client'

import { useState } from 'react'
import { useNotifications, useMarkRead, useMarkAllRead, useDeleteNotification, useClearAllNotifications } from '@/lib/hooks/useNotifications'
import { useLanguage } from '@/lib/hooks/useLanguage'
import PageHeading from '@/components/layout/PageHeading'
import PageContainer from '@/components/layout/PageContainer'

const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  role_request:  { bg: 'rgba(62,119,133,0.12)',  color: 'var(--brand-teal)'    },
  trip_request:  { bg: 'rgba(188,71,73,0.10)',   color: 'var(--brand-crimson)' },
  trip_created:  { bg: 'rgba(45,51,42,0.10)',    color: 'var(--brand-forest)'  },
  event_fetched: { bg: 'rgba(138,133,119,0.15)', color: 'var(--text-secondary)'},
  doc_expiry:    { bg: 'rgba(188,71,73,0.10)',   color: 'var(--brand-crimson)' },
  los_digest:    { bg: 'rgba(62,119,133,0.10)',  color: 'var(--brand-teal)'   },
}

const ALL_TYPES = ['role_request', 'trip_request', 'trip_created', 'event_fetched', 'doc_expiry', 'los_digest']

export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead      = useMarkRead()
  const markAllRead   = useMarkAllRead()
  const deleteOne     = useDeleteNotification()
  const clearAll      = useClearAllNotifications()
  const { t } = useLanguage()

  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all')

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins  = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days  = Math.floor(diff / 86400000)
    if (mins < 1)   return t('home.time.justNow')
    if (mins < 60)  return `${mins}${t('home.time.minutesAgo')}`
    if (hours < 24) return `${hours}${t('home.time.hoursAgo')}`
    return `${days}${t('home.time.daysAgo')}`
  }

  const TYPE_LABELS: Record<string, string> = {
    role_request:  t('notif.type.roleRequest'),
    trip_request:  t('notif.type.tripRequest'),
    trip_created:  t('notif.type.tripCreated'),
    event_fetched: t('notif.type.eventFetched'),
    doc_expiry:    t('notif.type.docExpiry'),
    los_digest:    t('notif.type.losDigest'),
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  const filtered = notifications.filter(n => {
    if (typeFilter !== 'all' && n.type !== typeFilter) return false
    if (readFilter === 'unread' && n.is_read) return false
    if (readFilter === 'read' && !n.is_read) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (!n.title.toLowerCase().includes(q) && !n.message.toLowerCase().includes(q)) return false
    }
    return true
  })

  const filtersActive = typeFilter !== 'all' || readFilter !== 'all' || search.trim() !== ''

  return (
    <>
      <PageHeading title={t('notif.pageTitle')} subtitle={t('notif.pageSubtitle')} />
      <PageContainer>
        <div className="max-w-2xl py-8 pb-16">

          {(unreadCount > 0 || notifications.length > 0) && (
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {unreadCount > 0 ? t('notif.unread').replace('{n}', String(unreadCount)) : ''}
              </p>
              <div className="flex items-center gap-4">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="text-sm font-medium disabled:opacity-50 hover:underline"
                    style={{ color: 'var(--brand-crimson)' }}
                  >
                    {t('notif.markAllRead')}
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => clearAll.mutate()}
                    disabled={clearAll.isPending}
                    className="text-sm font-medium disabled:opacity-50 hover:underline"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('notif.clearAll')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Filter bar ── */}
          {notifications.length > 0 && (
            <div className="space-y-3 mb-6">
              {/* Search */}
              <div className="relative">
                <svg
                  width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('notif.searchPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border transition-colors"
                  style={{
                    borderColor: 'var(--border-default)',
                    backgroundColor: 'white',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Read state + Type filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Read state */}
                <div className="flex gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
                  {(['all', 'unread', 'read'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setReadFilter(opt)}
                      className="px-3 py-1 rounded-md text-xs font-medium capitalize transition-all"
                      style={{
                        backgroundColor: readFilter === opt ? 'white' : 'transparent',
                        color: readFilter === opt ? 'var(--text-primary)' : 'var(--text-secondary)',
                        boxShadow: readFilter === opt ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      {opt === 'all' ? t('notif.filter.all') : opt === 'unread' ? t('notif.filter.unread') : t('notif.filter.read')}
                    </button>
                  ))}
                </div>

                {/* Type pills */}
                <button
                  onClick={() => setTypeFilter('all')}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    backgroundColor: typeFilter === 'all' ? 'var(--text-primary)' : 'rgba(0,0,0,0.06)',
                    color: typeFilter === 'all' ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {t('notif.filter.allTypes')}
                </button>
                {ALL_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(f => f === type ? 'all' : type)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      backgroundColor: typeFilter === type
                        ? (TYPE_STYLES[type]?.bg ?? 'rgba(0,0,0,0.06)')
                        : 'rgba(0,0,0,0.06)',
                      color: typeFilter === type
                        ? (TYPE_STYLES[type]?.color ?? 'var(--text-secondary)')
                        : 'var(--text-secondary)',
                      outline: typeFilter === type ? `1.5px solid ${TYPE_STYLES[type]?.color ?? 'transparent'}` : 'none',
                    }}
                  >
                    {TYPE_LABELS[type] ?? type}
                  </button>
                ))}
              </div>
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
                  stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{t('notif.allCaughtUp')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t('notif.empty')}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('notif.noMatch')}
              </p>
              {filtersActive && (
                <button
                  onClick={() => { setSearch(''); setTypeFilter('all'); setReadFilter('all') }}
                  className="text-xs mt-2 hover:underline"
                  style={{ color: 'var(--brand-crimson)' }}
                >
                  {t('notif.clearFilters')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(n => (
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
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: (TYPE_STYLES[n.type] ?? TYPE_STYLES.event_fetched).bg,
                            color: (TYPE_STYLES[n.type] ?? TYPE_STYLES.event_fetched).color,
                          }}>
                          {TYPE_LABELS[n.type] ?? n.type}
                        </span>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: 'var(--brand-crimson)' }} />
                        )}
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {n.title}
                      </p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {n.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {timeAgo(n.created_at)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteOne.mutate(n.id)
                        }}
                        disabled={deleteOne.isPending}
                        aria-label={t('notif.delete')}
                        className="p-1 rounded-lg opacity-40 hover:opacity-100 transition-opacity disabled:opacity-20"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/>
                          <path d="M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  {n.action_url && (
                    <a
                      href={n.action_url}
                      onClick={e => e.stopPropagation()}
                      className="text-xs font-medium mt-2 inline-block hover:underline"
                      style={{ color: 'var(--brand-crimson)' }}
                    >
                      {t('notif.view')}
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
