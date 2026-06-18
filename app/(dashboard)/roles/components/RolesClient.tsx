'use client'

import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate, formatTime } from '@/lib/format'
import type { RoleEvent } from '@/app/api/roles/route'

type Props = {
  events: RoleEvent[]
}

type SlotLabel = 'HOST' | 'SPEAKER' | 'PRODUCTS'

const SLOT_LABELS: SlotLabel[] = ['HOST', 'SPEAKER', 'PRODUCTS']

// Maps the DB constant to its i18n key
const SLOT_LABEL_KEY: Record<SlotLabel, 'event.roles.label.host' | 'event.roles.label.speaker' | 'event.roles.label.products'> = {
  HOST:     'event.roles.label.host',
  SPEAKER:  'event.roles.label.speaker',
  PRODUCTS: 'event.roles.label.products',
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function OccupantCell({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span style={{ color: 'var(--text-secondary)' }}>—</span>
    )
  }
  return (
    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
  )
}

// ── Desktop table ────────────────────────────────────────────────────────────

function RolesTable({ events, headers }: { events: RoleEvent[]; headers: string[] }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
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
        {headers.map(h => <span key={h}>{h}</span>)}
      </div>

      {/* Data rows */}
      {events.map((event, i) => {
        const isPast = new Date(event.start_time) < new Date()
        return (
          <div
            key={event.id}
            className="grid items-center px-4 py-3 text-sm transition-all"
            style={{
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
              borderTop: i === 0 ? undefined : '1px solid rgba(0,0,0,0.04)',
              opacity: isPast ? 0.6 : undefined,
              filter: isPast ? 'grayscale(0.5)' : undefined,
            }}
          >
            <span
              className="font-semibold truncate pr-4"
              style={{ color: 'var(--text-primary)' }}
            >
              {event.title}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {formatDate(event.start_time)}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {formatTime(event.start_time)}
            </span>
            <span className="text-xs"><OccupantCell name={event.slots.HOST} /></span>
            <span className="text-xs"><OccupantCell name={event.slots.SPEAKER} /></span>
            <span className="text-xs"><OccupantCell name={event.slots.PRODUCTS} /></span>
          </div>
        )
      })}
    </div>
  )
}

// ── Mobile cards ─────────────────────────────────────────────────────────────

function RolesCards({ events, slotLabels }: { events: RoleEvent[]; slotLabels: Record<SlotLabel, string> }) {
  return (
    <div className="flex flex-col gap-3">
      {events.map(event => {
        const isPast = new Date(event.start_time) < new Date()
        return (
          <div
            key={event.id}
            className="rounded-2xl p-4 transition-all"
            style={{
              border: '1px solid rgba(0,0,0,0.07)',
              backgroundColor: 'var(--bg-card)',
              opacity: isPast ? 0.6 : undefined,
              filter: isPast ? 'grayscale(0.5)' : undefined,
            }}
          >
          {/* Event title + date/time */}
          <p
            className="text-sm font-semibold mb-1 leading-snug"
            style={{ color: 'var(--text-primary)' }}
          >
            {event.title}
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            {formatDate(event.start_time)} · {formatTime(event.start_time)}
          </p>

          {/* Role slots */}
          <div className="flex flex-col gap-2">
            {SLOT_LABELS.map(label => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span
                  className="text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: 'var(--text-secondary)', minWidth: 72 }}
                >
                  {slotLabels[label]}
                </span>
                <span className="text-xs text-right">
                  <OccupantCell name={event.slots[label]} />
                </span>
              </div>
            ))}
          </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function RolesClient({ events }: Props) {
  const { t } = useLanguage()

  const headers = [
    t('event.roles.col.event'),
    t('event.roles.col.date'),
    t('event.roles.col.time'),
    t('event.roles.label.host'),
    t('event.roles.label.speaker'),
    t('event.roles.label.products'),
  ]

  const slotLabels: Record<SlotLabel, string> = {
    HOST:     t(SLOT_LABEL_KEY.HOST),
    SPEAKER:  t(SLOT_LABEL_KEY.SPEAKER),
    PRODUCTS: t(SLOT_LABEL_KEY.PRODUCTS),
  }

  return (
    <div className="py-8 pb-16">

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP layout (lg+)
          Full-width table with card container, max-w-5xl centred
          ════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block max-w-5xl mx-auto px-6">
        <h1
          className="font-display text-2xl font-bold mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('event.rolesPageTitle')}
        </h1>

        {events.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('event.rolesEmpty')}
          </p>
        ) : (
          <RolesTable events={events} headers={headers} />
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE layout (< lg)
          Stacked cards, full-width with px-4
          ════════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden px-4">
        <h1
          className="font-display text-xl font-bold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('event.rolesPageTitle')}
        </h1>

        {events.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('event.rolesEmpty')}
          </p>
        ) : (
          <RolesCards events={events} slotLabels={slotLabels} />
        )}
      </div>

    </div>
  )
}
