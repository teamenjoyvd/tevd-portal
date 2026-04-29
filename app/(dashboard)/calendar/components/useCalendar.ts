'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { type CalendarEvent, type View } from '@/app/(dashboard)/calendar/types'
import { toMonthParam } from '@/app/(dashboard)/calendar/utils'

// ── Types ──────────────────────────────────────────────────────────────────

type UseCalendarOptions = {
  initialEvents: CalendarEvent[]
  initialMonth: string
  initialEventId: string | null
  userRole: 'admin' | 'core' | 'member' | 'guest' | null
  isAuthenticated: boolean
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useCalendar({
  initialEvents,
  initialMonth,
  initialEventId,
  userRole,
  isAuthenticated,
}: UseCalendarOptions) {
  const [view, setView]             = useState<View>(initialEventId ? 'agenda' : 'month')
  const [current, setCurrent]       = useState<Date>(() => {
    const [y, m] = initialMonth.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [showN21, setShowN21]                 = useState(true)
  const [showPersonal, setShowPersonal]       = useState(true)
  const [filterType, setFilterType]           = useState<'in-person' | 'online' | 'hybrid' | null>(null)
  const [deepLinkId, setDeepLinkId]           = useState<string | null>(initialEventId)

  const canSeePersonal = isAuthenticated && userRole !== 'guest'

  const { data: monthEvents = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['events-month', toMonthParam(current)],
    queryFn: () =>
      apiClient<CalendarEvent[]>(`/api/calendar?month=${toMonthParam(current)}`),
    initialData: toMonthParam(current) === initialMonth ? initialEvents : undefined,
    staleTime: 60_000,
    enabled: view === 'month',
  })

  const { data: agendaEvents = [], isPending: agendaPending } = useQuery<CalendarEvent[]>({
    queryKey: ['events-agenda'],
    queryFn: () => apiClient<CalendarEvent[]>('/api/calendar'),
    staleTime: 0,
    enabled: view === 'agenda',
  })

  const rawEvents = view === 'agenda' ? agendaEvents : monthEvents

  const events = useMemo(() =>
    rawEvents.filter(e => {
      if (e.category === 'N21')      return showN21
      if (e.category === 'Personal') return canSeePersonal && showPersonal
      return true
    }).filter(e =>
      filterType === null || e.event_type === filterType
    ),
    [rawEvents, showN21, showPersonal, canSeePersonal, filterType]
  )

  const navigate = useCallback((dir: 1 | -1) => {
    setCurrent(prev => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + dir)
      return d
    })
  }, [])

  const goToday = useCallback(() => setCurrent(new Date()), [])

  const handleEventClick = useCallback((id: string) => {
    setSelectedEventId(id)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedEventId(null)
    setDeepLinkId(null)
  }, [])

  const handleDayClick = useCallback((date: Date) => {
    setCurrent(date)
  }, [])

  return {
    view,
    setView,
    current,
    showN21,
    setShowN21,
    showPersonal,
    setShowPersonal,
    filterType,
    setFilterType,
    canSeePersonal,
    events,
    agendaPending,
    deepLinkId,
    selectedEventId,
    navigate,
    goToday,
    handleEventClick,
    handleClose,
    handleDayClick,
  }
}
