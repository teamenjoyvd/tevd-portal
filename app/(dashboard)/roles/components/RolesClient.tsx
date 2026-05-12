'use client'

import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate, formatTime } from '@/lib/format'
import type { RoleEvent } from '@/app/api/roles/route'

type Props = {
  events: RoleEvent[]
}

const SLOT_LABELS = ['HOST', 'SPEAKER', 'PRODUCTS'] as const

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

function RolesTable({ events }: { events: RoleEvent[] }) {
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
        <span>Event</span>
        <span>Date</span>
        <span>Time</span>
        <span>Host</span>
        <span>Speaker</span>
        <span>Products</span>
      </div>

      {/* Data rows */}
      {events.map((event, i) => (
        <div
          key={event.id}
          className="grid items-center px-4 py-3 text-sm"
          style={{
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
            borderTop: i === 0 ? undefined : '1px solid rgba(0,0,0,0.04)',
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
      ))}
    </div>
  )
}

// ── Mobile cards ─────────────────────────────────────────────────────────────

function RolesCards({ events }: { events: RoleEvent[] }) {
  return (
    <div className="flex flex-col gap-3">
      {events.map(event => (
        <div
          key={event.id}
          className="rounded-2xl p-4"
          style={{
            border: '1px solid rgba(0,0,0,0.07)',
            backgroundColor: 'var(--bg-card)',
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
                  {label}
                </span>
                <span className="text-xs text-right">
                  <OccupantCell name={event.slots[label]} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function RolesClient({ events }: Props) {
  const { t } = useLanguage()

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
          <RolesTable events={events} />
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
          <RolesCards events={events} />
        )}
      </div>

    </div>
  )
}
