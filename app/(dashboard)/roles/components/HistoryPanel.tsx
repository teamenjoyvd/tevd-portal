'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate, formatTime } from '@/lib/format'
import type { RoleEvent } from '@/lib/roles/types'

type HistoryPanelProps = {
  events: RoleEvent[]
  count: number
  page: number
  limit: number
  search: string
  currentTime: string
}

function OccupantCell({ name }: { name: string | null }) {
  if (!name) {
    return <span style={{ color: 'var(--text-secondary)' }}>—</span>
  }
  return (
    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
      {name}
    </span>
  )
}

export default function HistoryPanel({
  events,
  count,
  page,
  limit,
  search,
  currentTime,
}: HistoryPanelProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Local search input state
  const [localSearch, setLocalSearch] = useState(search)

  // Keep local search input in sync if page params change externally
  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  const totalPages = Math.ceil(count / limit)

  function updateParams(newParams: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null) {
        params.delete(key)
      } else {
        params.set(key, val)
      }
    })
    startTransition(() => {
      router.replace(`/roles?${params.toString()}`, { scroll: false })
    })
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateParams({
      search: localSearch.trim() || null,
      page: null, // Reset to page 1 on new search
    })
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return
    updateParams({ page: newPage.toString() })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full max-w-md">
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder={t('event.roles.search.placeholder')}
          className="flex-1 px-4 py-2 text-sm rounded-xl border focus:outline-none transition-colors"
          style={{
            borderColor: 'rgba(0,0,0,0.12)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary-default)' }}
        >
          {t('event.roles.search.button')}
        </button>
      </form>

      {/* Loading overlay indicator */}
      {isPending && (
        <div className="text-xs animate-pulse" style={{ color: 'var(--primary-default)' }}>
          Loading...
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('event.roles.history.empty')}
        </p>
      ) : (
        <>
          {/* Desktop view (lg+) */}
          <div
            className="hidden lg:block rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(0,0,0,0.07)', backgroundColor: 'var(--bg-card)' }}
          >
            {/* Header row */}
            <div
              className="grid text-[10px] font-semibold tracking-widest uppercase px-4 py-2.5"
              style={{
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(0,0,0,0.02)',
              }}
            >
              <span>{t('event.roles.col.event')}</span>
              <span>{t('event.roles.col.date')}</span>
              <span>{t('event.roles.col.time')}</span>
              <span>{t('event.roles.label.host')}</span>
              <span>{t('event.roles.label.speaker')}</span>
              <span>{t('event.roles.label.products')}</span>
            </div>

            {/* Data rows */}
            {events.map((event, i) => {
              // Dimming is NOT applied in history view for readability (Issue 7 resolution)
              return (
                <div
                  key={event.id}
                  className="grid items-center px-4 py-3 text-sm transition-all"
                  style={{
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                    borderTop: i === 0 ? undefined : '1px solid rgba(0,0,0,0.04)',
                  }}
                >
                  <span className="font-semibold truncate pr-4" style={{ color: 'var(--text-primary)' }}>
                    {event.title}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(event.start_time)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {formatTime(event.start_time)}
                  </span>
                  <span className="text-xs">
                    <OccupantCell name={event.slots.HOST} />
                  </span>
                  <span className="text-xs">
                    <OccupantCell name={event.slots.SPEAKER} />
                  </span>
                  <span className="text-xs">
                    <OccupantCell name={event.slots.PRODUCTS} />
                  </span>
                </div>
              )
            })}
          </div>

          {/* Mobile view (< lg, 390px safe) */}
          <div className="lg:hidden flex flex-col gap-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl p-4 transition-all"
                style={{
                  border: '1px solid rgba(0,0,0,0.07)',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <p className="text-sm font-semibold mb-1 leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {event.title}
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {formatDate(event.start_time)} · {formatTime(event.start_time)}
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10px] font-semibold tracking-widest uppercase"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('event.roles.label.host')}
                    </span>
                    <span className="text-xs text-right">
                      <OccupantCell name={event.slots.HOST} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10px] font-semibold tracking-widest uppercase"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('event.roles.label.speaker')}
                    </span>
                    <span className="text-xs text-right">
                      <OccupantCell name={event.slots.SPEAKER} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10px] font-semibold tracking-widest uppercase"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('event.roles.label.products')}
                    </span>
                    <span className="text-xs text-right">
                      <OccupantCell name={event.slots.PRODUCTS} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4 mt-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages} ({count} items)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1 || isPending}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'rgba(0,0,0,0.12)',
                    color: 'var(--text-primary)',
                  }}
                >
                  Prev
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages || isPending}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'rgba(0,0,0,0.12)',
                    color: 'var(--text-primary)',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
