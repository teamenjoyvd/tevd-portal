'use client'

import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { DAYS_I18N } from '@/lib/i18n/translations'
import { type CalendarEvent } from '@/app/(dashboard)/calendar/types'
import {
  SOFIA_DATE_FMT,
  isoWeek,
  startOfWeek,
  addDays,
  sameDaySofia,
} from '@/app/(dashboard)/calendar/utils'
import { sofiaDateKeysBetween } from '@/lib/calendar-dates'
import { packWeek, MAX_LANES } from '@/lib/calendar-layout'
import { EventPill } from '@/app/(dashboard)/calendar/components/EventPill'

const LANE_HEIGHT = 20
const DAY_NUMBER_ROW_HEIGHT = 28
const OVERFLOW_ROW_HEIGHT = 14
const ROW_PADDING = 8

export function MonthView({
  current,
  events,
  onEventClick,
  onDayClick,
}: {
  current: Date
  events: CalendarEvent[]
  onEventClick: (id: string) => void
  onDayClick: (date: Date) => void
}) {
  const { lang, t } = useLanguage()
  const DAYS = DAYS_I18N[lang]
  const today = new Date()
  const gridStart = startOfWeek(current)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const cellDateKeys = useMemo(() => cells.map(d => SOFIA_DATE_FMT.format(d)), [cells])
  const currentMonthKey = SOFIA_DATE_FMT.format(current).slice(0, 7)

  // Events covering a given Sofia date key — used for aria-labels and the
  // overflow count, independent of the week-level bar packing.
  const eventsByDateKey = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    events.forEach(e => {
      sofiaDateKeysBetween(e.start_time, e.end_time).forEach(key => {
        if (!map[key]) map[key] = []
        map[key].push(e)
      })
    })
    return map
  }, [events])

  const todayIndex = useMemo(() => {
    const i = cells.findIndex(d => sameDaySofia(d, today))
    return i === -1 ? 0 : i
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  const [focusIndex, setFocusIndex] = useState(todayIndex)
  const cellRefs = useRef<(HTMLDivElement | null)[]>([])

  const focusCell = (index: number) => {
    const clamped = Math.max(0, Math.min(41, index))
    setFocusIndex(clamped)
    cellRefs.current[clamped]?.focus()
  }

  const handleGridKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number, date: Date) => {
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); focusCell(index + 1); break
      case 'ArrowLeft':  e.preventDefault(); focusCell(index - 1); break
      case 'ArrowDown':  e.preventDefault(); focusCell(index + 7); break
      case 'ArrowUp':    e.preventDefault(); focusCell(index - 7); break
      case 'Enter':
      case ' ':          e.preventDefault(); onDayClick(date); break
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-7 md:grid-cols-[40px_repeat(7,1fr)] border-b border-black/5 flex-shrink-0">
        <div className="hidden md:block" />
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold tracking-wide"
            style={{ color: 'var(--text-secondary)' }}>
            {d}
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto" role="grid" aria-label={t('cal.month')}>
        {Array.from({ length: 6 }, (_, week) => {
          const weekDays = cells.slice(week * 7, week * 7 + 7)
          const weekDateKeys = cellDateKeys.slice(week * 7, week * 7 + 7)
          const { segments, overflowByCol } = packWeek(weekDateKeys, events)
          const visibleLanes = Math.min(
            segments.reduce((max, s) => Math.max(max, s.lane + 1), 0),
            MAX_LANES
          )
          const rowMinHeight = Math.max(
            90,
            DAY_NUMBER_ROW_HEIGHT + visibleLanes * LANE_HEIGHT + OVERFLOW_ROW_HEIGHT + ROW_PADDING
          )
          return (
            <div key={week} role="row"
              className="grid grid-cols-7 md:grid-cols-[40px_repeat(7,1fr)] border-b border-black/5 [--col-offset:0] md:[--col-offset:1]"
              style={{
                minHeight: rowMinHeight,
                gridTemplateRows: `${DAY_NUMBER_ROW_HEIGHT}px repeat(${visibleLanes}, ${LANE_HEIGHT}px) ${OVERFLOW_ROW_HEIGHT}px`,
              }}
            >
              <div className="hidden md:flex items-start justify-center pt-2 flex-shrink-0" style={{ gridRow: '1 / -1' }}>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  W{isoWeek(weekDays[0])}
                </span>
              </div>
              {weekDays.map((date, di) => {
                const index = week * 7 + di
                const dateKey = weekDateKeys[di]
                const isToday = sameDaySofia(date, today)
                const isCurrentMonth = dateKey.slice(0, 7) === currentMonthKey
                const dayNumber = Number(dateKey.slice(8, 10))
                const dayEvents = eventsByDateKey[dateKey] ?? []
                const droppedCount = overflowByCol[di]
                const ariaLabel = dayEvents.length === 0
                  ? undefined
                  : dayEvents
                      .map(ev => {
                        const keys = sofiaDateKeysBetween(ev.start_time, ev.end_time)
                        const dayNum = keys.indexOf(dateKey) + 1
                        return keys.length > 1 ? `${ev.title} (Day ${dayNum}/${keys.length})` : ev.title
                      })
                      .join(', ')
                return (
                  <div
                    key={di}
                    ref={el => { cellRefs.current[index] = el }}
                    role="gridcell"
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={ariaLabel}
                    tabIndex={index === focusIndex ? 0 : -1}
                    onClick={() => { setFocusIndex(index); onDayClick(date) }}
                    onKeyDown={e => handleGridKeyDown(e, index, date)}
                    onFocus={() => setFocusIndex(index)}
                    className="border-l border-black/5 p-1 cursor-pointer hover:bg-black/[0.02] transition-colors overflow-hidden focus:outline-none focus:ring-2 focus:ring-inset"
                    style={{ gridRow: '1 / -1', ['--tw-ring-color' as string]: 'var(--brand-teal)' }}
                  >
                    <div className="flex justify-center">
                      <span
                        className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium flex-shrink-0"
                        style={{
                          backgroundColor: isToday ? 'var(--crimson)' : 'transparent',
                          color: isToday ? 'white' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-secondary)',
                          opacity: isCurrentMonth ? 1 : 0.4,
                        }}
                      >
                        {dayNumber}
                      </span>
                    </div>
                    {droppedCount > 0 && (
                      <p className="text-[10px] font-medium pl-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                        +{droppedCount} {t('cal.moreEvents')}
                      </p>
                    )}
                  </div>
                )
              })}
              {segments.map(seg => (
                <div
                  key={seg.event.id}
                  aria-hidden="true"
                  tabIndex={-1}
                  style={{
                    gridColumn: `calc(var(--col-offset) + ${seg.startCol + 1}) / span ${seg.span}`,
                    gridRow: seg.lane + 2,
                    minWidth: 0,
                  }}
                >
                  <EventPill
                    event={seg.event}
                    compact
                    continuesLeft={seg.continuesLeft}
                    continuesRight={seg.continuesRight}
                    onClick={() => onEventClick(seg.event.id)}
                  />
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
