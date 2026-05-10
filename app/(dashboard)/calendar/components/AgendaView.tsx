'use client'

import { useMemo, useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { type CalendarEvent } from '@/app/(dashboard)/calendar/types'
import { CATEGORY_COLOR, SOFIA_DATE_FMT, isoWeek, formatTime, formatShortDate } from '@/app/(dashboard)/calendar/utils'

export function AgendaView({
  events,
  onEventClick,
  isLoading,
  highlightId,
}: {
  events: CalendarEvent[]
  onEventClick: (id: string) => void
  isLoading: boolean
  highlightId?: string | null
}) {
  const { t } = useLanguage()
  const highlightRef = useRef<HTMLButtonElement | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)

  const todaySofia = SOFIA_DATE_FMT.format(new Date())

  const grouped = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    events
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .forEach(e => {
        const key = SOFIA_DATE_FMT.format(new Date(e.start_time))
        if (!map[key]) map[key] = []
        map[key].push(e)
      })
    return map
  }, [events])

  // The anchor is the first date >= today (i.e. today if it has events, otherwise
  // the next upcoming date). Falls back to the last date if all events are past.
  const anchorDateKey = useMemo(() => {
    const dates = Object.keys(grouped)
    return dates.find(d => d >= todaySofia) ?? dates[dates.length - 1]
  }, [grouped, todaySofia])

  // Mount-only: scroll to today once on load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      anchorRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' })
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  // Deep-link scroll: fires only when highlightId changes.
  useEffect(() => {
    if (!highlightId) return
    const raf = requestAnimationFrame(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => cancelAnimationFrame(raf)
  }, [highlightId])

  const dates = Object.keys(grouped)

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-6 w-32 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
            <div className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }} />
          </div>
        ))}
      </div>
    )
  }

  if (dates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('cal.noEvents')}</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      {dates.map(dateKey => {
        const date = new Date(`${dateKey}T12:00:00Z`)
        const isToday = dateKey === todaySofia
        const isPast = dateKey < todaySofia
        return (
          <div
            key={dateKey}
            ref={dateKey === anchorDateKey ? anchorRef : null}
            className="mb-6"
            style={{ opacity: isPast ? 0.5 : 1 }}
          >
            <div className="flex items-center gap-3 mb-2 py-2">
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: isToday ? 'var(--crimson)' : 'rgba(0,0,0,0.06)',
                  color: isToday ? 'white' : 'var(--text-primary)',
                }}
              >
                {formatShortDate(date)}
              </div>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                W{isoWeek(date)}
              </span>
            </div>
            <div className="space-y-2">
              {grouped[dateKey].map(ev => {
                const c = CATEGORY_COLOR[ev.category]
                const isHighlighted = ev.id === highlightId
                return (
                  <button
                    key={ev.id}
                    ref={isHighlighted ? highlightRef : null}
                    onClick={() => onEventClick(ev.id)}
                    className="w-full text-left rounded-xl border overflow-hidden hover:shadow-sm transition-shadow flex"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: isHighlighted ? 'var(--brand-crimson)' : 'rgba(0,0,0,0.05)',
                      boxShadow: isHighlighted ? '0 0 0 2px rgba(188,71,73,0.25)' : undefined,
                    }}
                  >
                    <div className="w-1 flex-shrink-0" style={{ backgroundColor: c.bg }} />
                    <div className="flex-1 px-4 py-3 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {ev.title}
                        </p>
                        <span className="text-xs flex-shrink-0 font-medium"
                          style={{ color: 'var(--text-secondary)' }}>
                          {formatTime(ev.start_time)}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {formatTime(ev.start_time)} &ndash; {formatTime(ev.end_time)}
                        {' · '}
                        <span style={{ color: c.bg }}>{ev.category}</span>
                      </p>
                      {ev.description && (
                        <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed"
                          style={{ color: 'var(--text-secondary)' }}>
                          {ev.description}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
