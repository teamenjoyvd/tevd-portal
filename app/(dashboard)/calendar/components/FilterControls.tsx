'use client'

import { type View } from '@/app/(dashboard)/calendar/types'
import { type TranslationKey } from '@/lib/i18n'

// ── Module-scope constants (shared with CalendarClient) ─────────────────────
export const VIEWS: { key: View; label: (t: (key: TranslationKey) => string) => string }[] = [
  { key: 'agenda', label: t => t('cal.agenda') },
  { key: 'month',  label: t => t('cal.month')  },
]

export const TYPE_FILTERS = ['in-person', 'online', 'hybrid'] as const

type FilterType = (typeof TYPE_FILTERS)[number] | null

type Props = {
  t: (key: TranslationKey) => string
  periodLabel: string
  navigate: (dir: 1 | -1) => void
  goToday: () => void
  view: View
  setView: (v: View) => void
  showN21: boolean
  setShowN21: (fn: (v: boolean) => boolean) => void
  canSeePersonal: boolean
  showPersonal: boolean
  setShowPersonal: (fn: (v: boolean) => boolean) => void
  filterType: FilterType
  setFilterType: (v: FilterType) => void
}

function typeLabel(type: (typeof TYPE_FILTERS)[number], t: (key: TranslationKey) => string) {
  return type === 'in-person' ? t('cal.inPerson') : type === 'online' ? t('cal.online') : t('cal.hybrid')
}

// ── Responsive filter/nav controls ───────────────────────────────────────────
// Renders the mobile top bar (<md) and the desktop sidebar (md+) from one
// component so the nav/view-switcher/filter state and markup only exist once.
export function FilterControls({
  t, periodLabel, navigate, goToday, view, setView,
  showN21, setShowN21, canSeePersonal, showPersonal, setShowPersonal,
  filterType, setFilterType,
}: Props) {
  return (
    <>
      {/* ── MOBILE ──────────────────────────────────────────────────────── */}
      <div className="md:hidden flex-shrink-0 border-b" style={{ backgroundColor: 'var(--bg-global)', borderColor: 'var(--border-default)' }}>
        <div className="max-w-[1024px] mx-auto px-4">
          <div className="flex items-center justify-between gap-2 py-2.5">
            <div className="flex items-center gap-1 min-w-0">
              <button onClick={() => navigate(-1)} aria-label={t('cal.prevMonth')}
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-black/5 flex-shrink-0"
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
              <button onClick={() => navigate(1)} aria-label={t('cal.nextMonth')}
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-black/5 flex-shrink-0"
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
            <div className="flex gap-0.5 p-0.5 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              {VIEWS.map(v => (
                <button key={v.key} onClick={() => setView(v.key)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                  style={{
                    backgroundColor: view === v.key ? 'white' : 'transparent',
                    color: view === v.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: view === v.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  {v.label(t)}
                </button>
              ))}
            </div>
          </div>

          {/* sticky top-[60px]: top-4 + h-14 from Header.tsx */}
          <div
            className="flex items-center gap-1.5 pb-2.5 overflow-x-auto sticky top-[60px] z-10"
            style={{ scrollbarWidth: 'none', backgroundColor: 'var(--bg-global)' }}
          >
            <button
              onClick={() => setShowN21(v => !v)}
              aria-pressed={showN21}
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
                aria-pressed={showPersonal}
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
                aria-pressed={filterType === type}
                className="px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 transition-all"
                style={{
                  backgroundColor: filterType === type ? 'var(--brand-teal)' : 'rgba(0,0,0,0.05)',
                  color: filterType === type ? 'white' : 'var(--text-secondary)',
                }}
              >
                {typeLabel(type, t)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── DESKTOP ─────────────────────────────────────────────────────── */}
      <div
        style={{ gridColumn: 'span 2', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        className="hidden md:flex rounded-2xl p-4 flex-col gap-4 sticky top-24"
      >
        <div>
          <p className="font-display text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {periodLabel}
          </p>
          <div className="flex gap-1 mt-2">
            <button onClick={() => navigate(-1)} aria-label={t('cal.prevMonth')}
              className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
              style={{ color: 'var(--text-primary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button onClick={() => navigate(1)} aria-label={t('cal.nextMonth')}
              className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
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
            {VIEWS.map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: view === v.key ? 'rgba(188,71,73,0.08)' : 'transparent',
                  color: view === v.key ? 'var(--brand-crimson)' : 'var(--text-secondary)',
                  fontWeight: view === v.key ? 600 : 400,
                }}>
                {v.label(t)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>{t('cal.category')}</p>
          <div className="flex flex-col gap-1.5">
            <button onClick={() => setShowN21(v => !v)} aria-pressed={showN21}
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
              <button onClick={() => setShowPersonal(v => !v)} aria-pressed={showPersonal}
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
              <button key={type} onClick={() => setFilterType(filterType === type ? null : type)} aria-pressed={filterType === type}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  backgroundColor: filterType === type ? 'var(--brand-teal)' : 'rgba(0,0,0,0.04)',
                  color: filterType === type ? 'white' : 'var(--text-secondary)',
                }}>
                {typeLabel(type, t)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
