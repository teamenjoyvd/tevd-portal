'use client'

import { useMemo, useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { type CalendarEvent } from '@/app/(dashboard)/calendar/types'
import { CATEGORY_COLOR, SOFIA_DATE_FMT, isoWeek, formatTime, formatShortDate } from '@/app/(dashboard)/calendar/utils'
import { sofiaDateKeysBetween } from '@/lib/calendar-dates'

type AgendaRow = { event: CalendarEvent; dayNum: number; totalDays: number }

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
  const hasScrolledRef = useRef(false)

  const todaySofia = SOFIA_DATE_FMT.format(new Date())

  const grouped = useMemo(() => {
    const map: Record<string, AgendaRow[]> = {}
    events
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .forEach(e => {
        const keys = sofiaDateKeysBetween(e.start_time, e.end_time)
        keys.forEach((key, i) => {
          if (!map[key]) map[key] = []
          map[key].push({ event: e, dayNum: i + 1, totalDays: keys.length })
        })
      })
    return map
  }, [events])

  // The anchor is the first date >= today (i.e. today if it has events, otherwise
  // the next upcoming date). Falls back to the last date if all events are past.
  const anchorDateKey = useMemo(() => {
    const dates = Object.keys(grouped)
    return dates.find(d => d >= todaySofia) ?? dates[dates.length - 1]
  }, [grouped, todaySofia])

  // Scroll to today once real content (not the loading skeleton) has rendered.
  // Guarded by hasScrolledRef so later re-renders (filter toggles, etc.) don't rescroll.
  useEffect(() => {
    if (isLoading || hasScrolledRef.current) return
    const raf = requestAnimationFrame(() => {
      anchorRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' })
      hasScrolledRef.current = true
    })
    return () => cancelAnimationFrame(raf)
  }, [isLoading, anchorDateKey])

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
            <div className="h-6 w-32 rounded-control animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
            <div className="h-16 rounded-container animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }} />
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
            className="mb-6 scroll-mt-20 md:scroll-mt-0"
            style={{ opacity: isPast ? 0.5 : 1 }}
          >
            <div className="flex items-center gap-3 mb-2 py-2">
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-control text-xs font-semibold"
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
              {grouped[dateKey].map(({ event: ev, dayNum, totalDays }) => {
                const c = CATEGORY_COLOR[ev.category]
                const isHighlighted = ev.id === highlightId
                return (
                  <button
                    key={`${ev.id}-${dateKey}`}
                    ref={isHighlighted ? highlightRef : null}
                    onClick={() => onEventClick(ev.id)}
                    className="w-full text-left rounded-container border overflow-hidden hover:shadow-sm transition-shadow flex scroll-mt-20 md:scroll-mt-0"
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
                          {totalDays > 1 && (
                            <span className="ml-1.5 text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                              {t('cal.dayOf').replace('{n}', String(dayNum)).replace('{m}', String(totalDays))}
                            </span>
                          )}
                        </p>
                        <span className="text-xs flex-shrink-0 font-medium"
                          style={{ color: 'var(--text-secondary)' }}>
                          {ev.is_all_day ? t('cal.allDay') : formatTime(ev.start_time)}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {ev.is_all_day
                          ? <span style={{ color: c.bg }}>{ev.category}</span>
                          : <>{formatTime(ev.start_time)} &ndash; {formatTime(ev.end_time)}{' · '}<span style={{ color: c.bg }}>{ev.category}</span></>
                        }
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
