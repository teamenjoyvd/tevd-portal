'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { MONTHS_I18N } from '@/lib/i18n/translations'
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { useCalendar } from '@/app/(dashboard)/calendar/components/useCalendar'
import { MonthView } from '@/app/(dashboard)/calendar/components/MonthView'
import { AgendaView } from '@/app/(dashboard)/calendar/components/AgendaView'
import { FilterControls } from '@/app/(dashboard)/calendar/components/FilterControls'
import { type CalendarEvent } from '@/app/(dashboard)/calendar/types'

const EventPopup = dynamic(() => import('@/app/(dashboard)/calendar/components/EventPopup'), { ssr: false })

// ── Props ───────────────────────────────────────────────────────────────────────────

type Props = {
  initialEvents: CalendarEvent[]
  initialMonth: string
  initialEventId: string | null
  userRole: 'admin' | 'core' | 'member' | 'guest' | null
  isAuthenticated: boolean
  profileNameMissing: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────────

export default function CalendarClient({
  initialEvents,
  initialMonth,
  initialEventId,
  userRole,
  isAuthenticated,
  profileNameMissing,
}: Props) {
  const { lang, t } = useLanguage()
  const MONTHS = MONTHS_I18N[lang]

  const {
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
  } = useCalendar({
    initialEvents,
    initialMonth,
    initialEventId,
    userRole,
    isAuthenticated,
  })

  const periodLabel = useMemo(
    () => `${MONTHS[current.getMonth()]} ${current.getFullYear()}`,
    [current, MONTHS]
  )

  return (
    <div className="w-full" style={{ backgroundColor: 'var(--bg-global)' }}>

      {/* ── MOBILE ──────────────────────────────────────────────────────────────── */}
      <div className="md:hidden">
        <FilterControls
          t={t}
          periodLabel={periodLabel}
          navigate={navigate}
          goToday={goToday}
          view={view}
          setView={setView}
          showN21={showN21}
          setShowN21={setShowN21}
          canSeePersonal={canSeePersonal}
          showPersonal={showPersonal}
          setShowPersonal={setShowPersonal}
          filterType={filterType}
          setFilterType={setFilterType}
        />

        {/* Mobile: document scrolls — no scroll container */}
        <div className="max-w-[1024px] mx-auto">
          {view === 'month' && (
            <MonthView current={current} events={events} onEventClick={handleEventClick} onDayClick={handleDayClick} />
          )}
          {view === 'agenda' && (
            <AgendaView events={events} onEventClick={handleEventClick} isLoading={agendaPending} highlightId={deepLinkId} />
          )}
        </div>
      </div>

      {/* ── DESKTOP ──────────────────────────────────────────────────────────────── */}
      <div className="hidden md:block py-8 pb-16">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 xl:px-12">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
              gap: '12px',
              alignItems: 'start',
            }}
          >
            <FilterControls
              t={t}
              periodLabel={periodLabel}
              navigate={navigate}
              goToday={goToday}
              view={view}
              setView={setView}
              showN21={showN21}
              setShowN21={setShowN21}
              canSeePersonal={canSeePersonal}
              showPersonal={showPersonal}
              setShowPersonal={setShowPersonal}
              filterType={filterType}
              setFilterType={setFilterType}
            />

            {/* col-10: calendar */}
            <div
              style={{ gridColumn: 'span 10', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-global)' }}
              className="rounded-2xl overflow-hidden"
            >
              {view === 'month' && (
                <MonthView
                  current={current}
                  events={events}
                  onEventClick={handleEventClick}
                  onDayClick={handleDayClick}
                />
              )}
              {view === 'agenda' && (
                /* Desktop: internal scroll container owns --cal-height */
                <div className="overflow-y-auto" style={{ height: 'var(--cal-height)' }}>
                  <AgendaView
                    events={events}
                    onEventClick={handleEventClick}
                    isLoading={agendaPending}
                    highlightId={deepLinkId}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event modal — mobile: bottom sheet; desktop: centered card */}
      <Dialog open={!!selectedEventId} onOpenChange={open => { if (!open) handleClose() }}>
        <DialogPortal>
          <DialogOverlay
            style={{ backgroundColor: 'var(--overlay)' }}
          />
          <DialogContent
            className="fixed flex flex-col overflow-hidden p-0
              inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-container
              md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-[360px] md:max-h-[80vh] md:rounded-container md:-translate-x-1/2 md:-translate-y-1/2"
            style={{
              backgroundColor: 'var(--bg-global)',
              boxShadow: 'var(--shadow-modal)',
            }}
          >
            {selectedEventId && (
              <EventPopup
                eventId={selectedEventId}
                onClose={handleClose}
                userRole={userRole}
                profileNameMissing={profileNameMissing}
              />
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
