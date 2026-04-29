'use client'

import { useMemo } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { MONTHS_I18N } from '@/lib/i18n/translations'
import { VaulDrawer } from '@/components/ui/vaul-drawer'
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import EventPopup from '@/app/(dashboard)/calendar/components/EventPopup'
import { useCalendar } from '@/app/(dashboard)/calendar/components/useCalendar'
import MonthView from '@/app/(dashboard)/calendar/components/MonthView'
import AgendaView from '@/app/(dashboard)/calendar/components/AgendaView'
import { type CalendarEvent, type View } from '@/app/(dashboard)/calendar/types'

// ── Props ─────────────────────────────────────────────────────────────────

type Props = {
  initialEvents: CalendarEvent[]
  initialMonth: string
  initialEventId: string | null
  userRole: 'admin' | 'core' | 'member' | 'guest' | null
  userProfileId: string | null
  isAuthenticated: boolean
}

// ── Component ─────────────────────────────────────────────────────────────

export default function CalendarClient({
  initialEvents,
  initialMonth,
  initialEventId,
  userRole,
  userProfileId,
  isAuthenticated,
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

  const views: { key: View; label: string }[] = [
    { key: 'agenda', label: t('cal.agenda') },
    { key: 'month',  label: t('cal.month')  },
  ]

  const TYPE_FILTERS = ['in-person', 'online', 'hybrid'] as const

  return (
    <div className="w-full" style={{ backgroundColor: 'var(--bg-global)' }}>

      {/* ── MOBILE ────────────────────────────────────────────────────── */}
      <div className="md:hidden">
        <div className="flex-shrink-0 border-b" style={{ backgroundColor: 'var(--bg-global)', borderColor: 'var(--border-default)' }}>
          <div className="max-w-[1024px] mx-auto px-4">

            {/* Row 1: nav + period label (left) | view switcher (right) */}
            <div className="flex items-center justify-between gap-2 py-2.5">
              <div className="flex items-center gap-1 min-w-0">
                <button onClick={() => navigate(-1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 flex-shrink-0"
                  style={{ color: 'var(--text-primary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <button onClick={goToday}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border flex-shrink-0"
                  style={{ borderColor: 'var(--crimson)', color: 'var(--crimson)' }}>
                  {t('cal.today')}
                </button>
                <button onClick={() => navigate(1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 flex-shrink-0"
                  style={{ color: 'var(--text-primary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
                <p className="text-sm font-semibold truncate ml-1" style={{ color: 'var(--text-primary)' }}>
                  {periodLabel}
                </p>
              </div>
              {/* View switcher — right side of Row 1 */}
              <div className="flex gap-0.5 p-0.5 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
                {views.map(v => (
                  <button key={v.key} onClick={() => setView(v.key)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                    style={{
                      backgroundColor: view === v.key ? 'white' : 'transparent',
                      color: view === v.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: view === v.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: category + format filter chips */}
            <div className="flex items-center gap-1.5 pb-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setShowN21(v => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 transition-all"
                style={{
                  backgroundColor: showN21 ? 'var(--forest)' : 'rgba(0,0,0,0.05)',
                  color: showN21 ? 'white' : 'var(--text-secondary)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: showN21 ? 'rgba(255,255,255,0.6)' : 'var(--forest)' }} />
                N21
              </button>
              {canSeePersonal && (
                <button
                  onClick={() => setShowPersonal(v => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 transition-all"
                  style={{
                    backgroundColor: showPersonal ? 'var(--sienna)' : 'rgba(0,0,0,0.05)',
                    color: showPersonal ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: showPersonal ? 'rgba(255,255,255,0.6)' : 'var(--sienna)' }} />
                  {t('cal.personal')}
                </button>
              )}
              <div className="w-px h-4 flex-shrink-0" style={{ backgroundColor: 'var(--border-default)' }} />
              {TYPE_FILTERS.map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(filterType === type ? null : type)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 transition-all"
                  style={{
                    backgroundColor: filterType === type ? 'var(--brand-teal)' : 'rgba(0,0,0,0.05)',
                    color: filterType === type ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {type === 'in-person' ? t('cal.inPerson') : type === 'online' ? t('cal.online') : t('cal.hybrid')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="max-w-[1024px] mx-auto">
          {view === 'month' && (
            <MonthView current={current} events={events} onEventClick={handleEventClick} onDayClick={handleDayClick} />
          )}
          {view === 'agenda' && (
            <AgendaView events={events} onEventClick={handleEventClick} isLoading={agendaPending} highlightId={deepLinkId} />
          )}
        </div>

        {/* Mobile event sheet */}
        {selectedEventId && (
          <VaulDrawer open onClose={handleClose} snapPoints={[0.5, 0.92]} fadeFromIndex={1}>
            <EventPopup
              eventId={selectedEventId}
              onClose={handleClose}
              userRole={userRole}
              userProfileId={userProfileId}
            />
          </VaulDrawer>
        )}
      </div>

      {/* ── DESKTOP ──────────────────────────────────────────────────── */}
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
            {/* col-2: left nav sidebar */}
            <div
              style={{ gridColumn: 'span 2', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
              className="rounded-2xl p-4 flex flex-col gap-4 sticky top-24"
            >
              <div>
                <p className="font-display text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {periodLabel}
                </p>
                <div className="flex gap-1 mt-2">
                  <button onClick={() => navigate(-1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
                    style={{ color: 'var(--text-primary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <button onClick={() => navigate(1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
                    style={{ color: 'var(--text-primary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
                <button onClick={goToday}
                  className="mt-2 w-full px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-black/[0.02]"
                  style={{ borderColor: 'var(--crimson)', color: 'var(--crimson)' }}>
                  {t('cal.today')}
                </button>
              </div>

              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>{t('cal.view')}</p>
                <div className="flex flex-col gap-0.5">
                  {views.map(v => (
                    <button key={v.key} onClick={() => setView(v.key)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        backgroundColor: view === v.key ? 'rgba(188,71,73,0.08)' : 'transparent',
                        color: view === v.key ? 'var(--brand-crimson)' : 'var(--text-secondary)',
                        fontWeight: view === v.key ? 600 : 400,
                      }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>{t('cal.category')}</p>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => setShowN21(v => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: showN21 ? 'var(--forest)' : 'rgba(0,0,0,0.04)',
                      color: showN21 ? 'white' : 'var(--text-secondary)',
                    }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: showN21 ? 'rgba(255,255,255,0.6)' : 'var(--forest)' }} />
                    N21
                  </button>
                  {canSeePersonal && (
                    <button onClick={() => setShowPersonal(v => !v)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: showPersonal ? 'var(--sienna)' : 'rgba(0,0,0,0.04)',
                        color: showPersonal ? 'white' : 'var(--text-secondary)',
                      }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: showPersonal ? 'rgba(255,255,255,0.6)' : 'var(--sienna)' }} />
                      {t('cal.personal')}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>{t('cal.format')}</p>
                <div className="flex flex-col gap-1">
                  {TYPE_FILTERS.map(type => (
                    <button key={type} onClick={() => setFilterType(filterType === type ? null : type)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: filterType === type ? 'var(--brand-teal)' : 'rgba(0,0,0,0.04)',
                        color: filterType === type ? 'white' : 'var(--text-secondary)',
                      }}>
                      {type === 'in-person' ? t('cal.inPerson') : type === 'online' ? t('cal.online') : t('cal.hybrid')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

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
                <AgendaView
                  events={events}
                  onEventClick={handleEventClick}
                  isLoading={agendaPending}
                  highlightId={deepLinkId}
                />
              )}
            </div>
          </div>
        </div>

        {/* Desktop event modal */}
        <Dialog open={!!selectedEventId} onOpenChange={open => { if (!open) handleClose() }}>
          <DialogPortal>
            <DialogOverlay
              style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            />
            <DialogContent
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 360,
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '1rem',
                backgroundColor: 'var(--bg-global)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
                overflow: 'hidden',
                padding: 0,
              }}
            >
              {selectedEventId && (
                <EventPopup
                  eventId={selectedEventId}
                  onClose={handleClose}
                  userRole={userRole}
                  userProfileId={userProfileId}
                />
              )}
            </DialogContent>
          </DialogPortal>
        </Dialog>
      </div>
    </div>
  )
}
