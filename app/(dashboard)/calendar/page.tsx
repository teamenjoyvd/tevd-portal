'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import EventPopup from '@/components/events/EventPopup'

// ── Types ──────────────────────────────────────────────────────────────────

type CalendarEvent = {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  category: 'N21' | 'Personal'
  week_number: number
  visibility_roles: string[]
}

type View = 'month' | 'week' | 'day' | 'agenda'

type UserProfile = {
  id: string
  role: 'admin' | 'core' | 'member' | 'guest'
}

// ── Constants ──────────────────────────────────────────────────────────────

const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const HOURS  = Array.from({ length: 24 }, (_, i) => i)

const CATEGORY_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  N21:      { bg: 'var(--forest)',  text: 'rgba(255,255,255,0.95)', dot: 'var(--forest)'  },
  Personal: { bg: 'var(--sienna)', text: 'rgba(255,255,255,0.95)', dot: 'var(--sienna)' },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isoWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const w1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function eventMinutesFromMidnight(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function eventDurationMinutes(start: string, end: string): number {
  return Math.max(30, (new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

// ── Category pill ──────────────────────────────────────────────────────────

function CategoryPill({
  category, active, onClick, visible,
}: {
  category: 'N21' | 'Personal'; active: boolean; onClick: () => void; visible: boolean
}) {
  if (!visible) return null
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
      style={{
        backgroundColor: active ? CATEGORY_COLOR[category].bg : 'rgba(0,0,0,0.06)',
        color: active ? CATEGORY_COLOR[category].text : 'var(--stone)',
        opacity: 1,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: active ? 'rgba(255,255,255,0.7)' : CATEGORY_COLOR[category].dot }}
      />
      {category}
    </button>
  )
}

// ── Event pill (month/week/day) ────────────────────────────────────────────

function EventPill({
  event, onClick, compact = false,
}: {
  event: CalendarEvent; onClick: () => void; compact?: boolean
}) {
  const c = CATEGORY_COLOR[event.category]
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className="w-full text-left rounded-md px-1.5 truncate transition-opacity hover:opacity-80 active:opacity-60"
      style={{
        backgroundColor: c.bg,
        color: c.text,
        fontSize: compact ? '10px' : '11px',
        fontWeight: 500,
        lineHeight: compact ? '18px' : '20px',
        minHeight: compact ? '18px' : '20px',
      }}
    >
      {compact ? event.title : `${formatTime(event.start_time)} ${event.title}`}
    </button>
  )
}

// ── Month View ─────────────────────────────────────────────────────────────

function MonthView({
  current, events, onEventClick, onDayClick,
}: {
  current: Date
  events: CalendarEvent[]
  onEventClick: (id: string) => void
  onDayClick: (date: Date) => void
}) {
  const today = new Date()

  // Build grid — 6 rows × 7 cols, starting Monday
  const firstOfMonth = new Date(current.getFullYear(), current.getMonth(), 1)
  const gridStart = startOfWeek(firstOfMonth)
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  const eventsOnDay = (date: Date) =>
    events.filter(e => sameDay(new Date(e.start_time), date))

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-[40px_repeat(7,1fr)] border-b border-black/5">
        <div className="w-10" /> {/* week number column */}
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold tracking-wide"
            style={{ color: 'var(--stone)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      <div className="flex-1 overflow-y-auto">
        {Array.from({ length: 6 }, (_, week) => {
          const weekDays = cells.slice(week * 7, week * 7 + 7)
          const weekNum = isoWeek(weekDays[0])
          return (
            <div key={week} className="grid grid-cols-[40px_repeat(7,1fr)] border-b border-black/5 min-h-[90px]">
              {/* Week number */}
              <div className="flex items-start justify-center pt-2">
                <span className="text-[10px] font-semibold" style={{ color: 'var(--stone)' }}>
                  W{weekNum}
                </span>
              </div>
              {weekDays.map((date, di) => {
                const isToday = sameDay(date, today)
                const isCurrentMonth = date.getMonth() === current.getMonth()
                const dayEvents = eventsOnDay(date)
                return (
                  <div
                    key={di}
                    onClick={() => onDayClick(date)}
                    className="border-l border-black/5 p-1 cursor-pointer hover:bg-black/[0.02] transition-colors"
                    style={{ minHeight: 90 }}
                  >
                    {/* Date number */}
                    <div className="flex justify-center mb-1">
                      <span
                        className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: isToday ? 'var(--crimson)' : 'transparent',
                          color: isToday ? 'white' : isCurrentMonth ? 'var(--deep)' : 'var(--stone)',
                          opacity: isCurrentMonth ? 1 : 0.4,
                        }}
                      >
                        {date.getDate()}
                      </span>
                    </div>
                    {/* Events — show max 3, +N more */}
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <EventPill key={ev.id} event={ev} compact onClick={() => onEventClick(ev.id)} />
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] font-medium pl-1" style={{ color: 'var(--stone)' }}>
                          +{dayEvents.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ──────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 60 // px per hour

function WeekView({
  current, events, onEventClick,
}: {
  current: Date
  events: CalendarEvent[]
  onEventClick: (id: string) => void
}) {
  const today = new Date()
  const weekStart = startOfWeek(current)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const eventsOnDay = (date: Date) =>
    events.filter(e => sameDay(new Date(e.start_time), date))

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-black/5 flex-shrink-0">
        <div />
        {days.map((d, i) => {
          const isToday = sameDay(d, today)
          return (
            <div key={i} className="py-2 text-center border-l border-black/5">
              <p className="text-[10px] font-semibold tracking-wide uppercase"
                style={{ color: 'var(--stone)' }}>
                {DAYS[i]}
              </p>
              <span
                className="w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mx-auto mt-0.5"
                style={{
                  backgroundColor: isToday ? 'var(--crimson)' : 'transparent',
                  color: isToday ? 'white' : 'var(--deep)',
                }}
              >
                {d.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[48px_repeat(7,1fr)]" style={{ height: HOUR_HEIGHT * 24 }}>
          {/* Hour labels */}
          <div>
            {HOURS.map(h => (
              <div key={h} style={{ height: HOUR_HEIGHT }}
                className="flex items-start justify-end pr-2 pt-1">
                {h > 0 && (
                  <span className="text-[10px] font-medium" style={{ color: 'var(--stone)' }}>
                    {String(h).padStart(2, '0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((date, di) => {
            const dayEvents = eventsOnDay(date)
            return (
              <div key={di} className="relative border-l border-black/5"
                style={{ height: HOUR_HEIGHT * 24 }}>
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div key={h} className="absolute w-full border-t border-black/[0.04]"
                    style={{ top: h * HOUR_HEIGHT }} />
                ))}
                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div key={`h-${h}`} className="absolute w-full border-t border-black/[0.02]"
                    style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                ))}
                {/* Events */}
                {dayEvents.map(ev => {
                  const top = (eventMinutesFromMidnight(ev.start_time) / 60) * HOUR_HEIGHT
                  const height = Math.max(22, (eventDurationMinutes(ev.start_time, ev.end_time) / 60) * HOUR_HEIGHT)
                  const c = CATEGORY_COLOR[ev.category]
                  return (
                    <button
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev.id) }}
                      className="absolute left-0.5 right-0.5 rounded-md px-1.5 text-left overflow-hidden hover:opacity-80 transition-opacity"
                      style={{
                        top: top + 1,
                        height: height - 2,
                        backgroundColor: c.bg,
                        color: c.text,
                        zIndex: 1,
                      }}
                    >
                      <p className="text-[10px] font-semibold truncate leading-tight mt-0.5">
                        {ev.title}
                      </p>
                      {height > 36 && (
                        <p className="text-[9px] opacity-80 leading-tight">
                          {formatTime(ev.start_time)}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Day View ───────────────────────────────────────────────────────────────

function DayView({
  current, events, onEventClick,
}: {
  current: Date
  events: CalendarEvent[]
  onEventClick: (id: string) => void
}) {
  const dayEvents = events.filter(e => sameDay(new Date(e.start_time), current))

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-black/5 flex-shrink-0">
        <p className="font-serif text-lg font-semibold" style={{ color: 'var(--deep)' }}>
          {current.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
          W{isoWeek(current)}
        </p>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[48px_1fr]" style={{ height: HOUR_HEIGHT * 24 }}>
          {/* Hours */}
          <div>
            {HOURS.map(h => (
              <div key={h} style={{ height: HOUR_HEIGHT }}
                className="flex items-start justify-end pr-2 pt-1">
                {h > 0 && (
                  <span className="text-[10px] font-medium" style={{ color: 'var(--stone)' }}>
                    {String(h).padStart(2, '0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Events column */}
          <div className="relative border-l border-black/5" style={{ height: HOUR_HEIGHT * 24 }}>
            {HOURS.map(h => (
              <div key={h} className="absolute w-full border-t border-black/[0.04]"
                style={{ top: h * HOUR_HEIGHT }} />
            ))}
            {HOURS.map(h => (
              <div key={`h-${h}`} className="absolute w-full border-t border-black/[0.02]"
                style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
            ))}
            {dayEvents.map(ev => {
              const top = (eventMinutesFromMidnight(ev.start_time) / 60) * HOUR_HEIGHT
              const height = Math.max(28, (eventDurationMinutes(ev.start_time, ev.end_time) / 60) * HOUR_HEIGHT)
              const c = CATEGORY_COLOR[ev.category]
              return (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev.id)}
                  className="absolute left-1 right-1 rounded-lg px-3 text-left overflow-hidden hover:opacity-80 transition-opacity"
                  style={{ top: top + 1, height: height - 2, backgroundColor: c.bg, color: c.text }}
                >
                  <p className="text-xs font-semibold truncate mt-1">{ev.title}</p>
                  {height > 44 && (
                    <p className="text-[10px] opacity-80">{formatTime(ev.start_time)} – {formatTime(ev.end_time)}</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Agenda View ────────────────────────────────────────────────────────────

function AgendaView({
  events, onEventClick,
}: {
  events: CalendarEvent[]
  onEventClick: (id: string) => void
}) {
  const today = new Date()

  // Group by date string
  const grouped = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    events
      .filter(e => new Date(e.start_time) >= new Date(today.setHours(0, 0, 0, 0)))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .forEach(e => {
        const key = new Date(e.start_time).toDateString()
        if (!map[key]) map[key] = []
        map[key].push(e)
      })
    return map
  }, [events])

  const dates = Object.keys(grouped)

  if (dates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--stone)' }}>No upcoming events.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {dates.map(dateKey => {
        const date = new Date(dateKey)
        const isToday = sameDay(date, new Date())
        return (
          <div key={dateKey} className="mb-6">
            {/* Date header */}
            <div className="flex items-center gap-3 mb-2 sticky top-0 py-2"
              style={{ backgroundColor: 'var(--eggshell)' }}>
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: isToday ? 'var(--crimson)' : 'rgba(0,0,0,0.06)',
                  color: isToday ? 'white' : 'var(--deep)',
                }}
              >
                {formatShortDate(date)}
              </div>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--stone)' }}>
                W{isoWeek(date)}
              </span>
            </div>
            {/* Events */}
            <div className="space-y-2">
              {grouped[dateKey].map(ev => {
                const c = CATEGORY_COLOR[ev.category]
                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev.id)}
                    className="w-full text-left rounded-xl border border-black/5 overflow-hidden hover:shadow-sm transition-shadow flex"
                    style={{ backgroundColor: 'white' }}
                  >
                    {/* Category stripe */}
                    <div className="w-1 flex-shrink-0" style={{ backgroundColor: c.bg }} />
                    <div className="flex-1 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold" style={{ color: 'var(--deep)' }}>
                          {ev.title}
                        </p>
                        <span className="text-xs flex-shrink-0 font-medium"
                          style={{ color: 'var(--stone)' }}>
                          {formatTime(ev.start_time)}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                        {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                        {' · '}
                        <span style={{ color: c.bg }}>{ev.category}</span>
                      </p>
                      {ev.description && (
                        <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed"
                          style={{ color: 'var(--stone)' }}>
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

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user, isSignedIn } = useUser()
  const [view, setView]         = useState<View>('month')
  const [current, setCurrent]   = useState(new Date())
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [showN21, setShowN21]       = useState(true)
  const [showPersonal, setShowPersonal] = useState(true)

  // Fetch user profile for role
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
    enabled: !!isSignedIn,
  })

  const userRole = profile?.role ?? (isSignedIn ? 'member' : null)
  const canSeePersonal = isSignedIn && userRole !== 'guest'
  const isGuest = !isSignedIn || userRole === 'guest'

  // Determine fetch month range — fetch 3 months for agenda, 1 for others
  const fetchMonth = view === 'agenda'
    ? null // no month filter for agenda
    : `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`

  const { data: rawEvents = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['events', fetchMonth],
    queryFn: () => fetch(`/api/calendar${fetchMonth ? `?month=${fetchMonth}` : ''}`).then(r => r.json()),
    staleTime: 60_000,
  })

  // Apply category filters
  const events = useMemo(() =>
    rawEvents.filter(e => {
      if (e.category === 'N21') return showN21
      if (e.category === 'Personal') return canSeePersonal && showPersonal
      return true
    }),
    [rawEvents, showN21, showPersonal, canSeePersonal]
  )

  // Navigation
  const navigate = useCallback((dir: 1 | -1) => {
    setCurrent(prev => {
      const d = new Date(prev)
      if (view === 'month')  d.setMonth(d.getMonth() + dir)
      if (view === 'week')   d.setDate(d.getDate() + dir * 7)
      if (view === 'day')    d.setDate(d.getDate() + dir)
      if (view === 'agenda') d.setMonth(d.getMonth() + dir)
      return d
    })
  }, [view])

  const goToday = useCallback(() => setCurrent(new Date()), [])

  // Title for current period
  const periodLabel = useMemo(() => {
    if (view === 'month' || view === 'agenda') {
      return `${MONTHS[current.getMonth()]} ${current.getFullYear()}`
    }
    if (view === 'week') {
      const ws = startOfWeek(current)
      const we = addDays(ws, 6)
      return `W${isoWeek(ws)} · ${ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${we.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    if (view === 'day') {
      return current.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    return ''
  }, [view, current])

  // When clicking a day in month view, switch to day view
  const handleDayClick = (date: Date) => {
    setCurrent(date)
    setView('day')
  }

  const views: { key: View; label: string }[] = [
    { key: 'month',  label: 'Month'  },
    { key: 'week',   label: 'Week'   },
    { key: 'day',    label: 'Day'    },
    { key: 'agenda', label: 'Agenda' },
  ]

  return (
    <div className="flex flex-col h-[calc(100dvh-56px-64px)] md:h-[calc(100dvh-56px)]"
      style={{ backgroundColor: 'var(--eggshell)' }}>

      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 border-b border-black/5 px-3 py-2.5"
        style={{ backgroundColor: 'white' }}>

        {/* Row 1: nav + title */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
            style={{ color: 'var(--deep)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
            style={{ color: 'var(--deep)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          <p className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--deep)' }}>
            {periodLabel}
          </p>

          <button
            onClick={goToday}
            className="px-3 py-1 rounded-lg text-xs font-semibold border transition-colors"
            style={{ borderColor: 'var(--crimson)', color: 'var(--crimson)' }}
          >
            Today
          </button>
        </div>

        {/* Row 2: view toggles + category filters */}
        <div className="flex items-center justify-between gap-2">
          {/* View toggles */}
          <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
            {views.map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  backgroundColor: view === v.key ? 'white' : 'transparent',
                  color: view === v.key ? 'var(--deep)' : 'var(--stone)',
                  boxShadow: view === v.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Category filters */}
          <div className="flex gap-1.5">
            <CategoryPill
              category="N21"
              active={showN21}
              onClick={() => setShowN21(v => !v)}
              visible={true}
            />
            <CategoryPill
              category="Personal"
              active={showPersonal}
              onClick={() => setShowPersonal(v => !v)}
              visible={canSeePersonal}
            />
          </div>
        </div>
      </div>

      {/* ── View content ── */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="space-y-2 w-full max-w-sm px-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {view === 'month'  && <MonthView  current={current} events={events} onEventClick={setSelectedEventId} onDayClick={handleDayClick} />}
          {view === 'week'   && <WeekView   current={current} events={events} onEventClick={setSelectedEventId} />}
          {view === 'day'    && <DayView    current={current} events={events} onEventClick={setSelectedEventId} />}
          {view === 'agenda' && <AgendaView events={events} onEventClick={setSelectedEventId} />}
        </>
      )}

      {/* ── Event popup ── */}
      {selectedEventId && (
        <EventPopup
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
          userRole={userRole as 'admin' | 'core' | 'member' | 'guest' | null}
          userProfileId={profile?.id ?? null}
        />
      )}
    </div>
  )
}