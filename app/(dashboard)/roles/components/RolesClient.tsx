'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate, formatTime } from '@/lib/format'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { RoleEvent } from '@/lib/roles/types'
import { Database } from '@/types/supabase'
import type { TranslationKey } from '@/lib/i18n'
import HistoryPanel from './HistoryPanel'
import LeaderboardPanel from './LeaderboardPanel'

type Props = {
  tab: string
  selectedYear: number
  selectedQuarter: number
  currentYear: number
  currentQuarter: number
  currentTime: string
  quarterEvents: RoleEvent[]
  historyEvents: RoleEvent[]
  historyCount: number
  historyPage: number
  historyLimit: number
  historySearch: string
  leaderboardData: Database['public']['Views']['member_roles_leaderboard']['Row'][]
}

type SlotLabel = 'HOST' | 'SPEAKER' | 'PRODUCTS'
const SLOT_LABELS: SlotLabel[] = ['HOST', 'SPEAKER', 'PRODUCTS']

const SLOT_LABEL_KEY: Record<SlotLabel, 'event.roles.label.host' | 'event.roles.label.speaker' | 'event.roles.label.products'> = {
  HOST:     'event.roles.label.host',
  SPEAKER:  'event.roles.label.speaker',
  PRODUCTS: 'event.roles.label.products',
}

function OccupantCell({ name }: { name: string | null }) {
  if (!name || name === '') {
    return (
      <span style={{ color: 'var(--text-secondary)' }}>—</span>
    )
  }
  return (
    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
  )
}

// ── Desktop table ────────────────────────────────────────────────────────────
function RolesTable({
  events,
  headers,
  currentTime,
  isCurrentQuarter,
}: {
  events: RoleEvent[]
  headers: string[]
  currentTime: string
  isCurrentQuarter: boolean
}) {
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
        const isPast = isCurrentQuarter && (new Date(event.start_time) < new Date(currentTime))
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
function RolesCards({
  events,
  slotLabels,
  currentTime,
  isCurrentQuarter,
}: {
  events: RoleEvent[]
  slotLabels: Record<SlotLabel, string>
  currentTime: string
  isCurrentQuarter: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      {events.map(event => {
        const isPast = isCurrentQuarter && (new Date(event.start_time) < new Date(currentTime))
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
export default function RolesClient({
  tab,
  selectedYear,
  selectedQuarter,
  currentYear,
  currentQuarter,
  currentTime,
  quarterEvents,
  historyEvents,
  historyCount,
  historyPage,
  historyLimit,
  historySearch,
  leaderboardData,
}: Props) {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const isCurrentQuarter = selectedYear === currentYear && selectedQuarter === currentQuarter

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

  // Generate Year options from currentYear - 2 to currentYear + 2
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    // Clear other params when changing primary view tabs
    params.delete('page')
    params.delete('search')
    params.delete('quarter')
    params.delete('year')
    startTransition(() => {
      router.replace(`/roles?${params.toString()}`, { scroll: false })
    })
  }

  function handleYearChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', value)
    startTransition(() => {
      router.replace(`/roles?${params.toString()}`, { scroll: false })
    })
  }

  function handleQuarterChange(value: string) {
    const q = value.replace('Q', '')
    const params = new URLSearchParams(searchParams.toString())
    params.set('quarter', q)
    startTransition(() => {
      router.replace(`/roles?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="py-8 pb-16 max-w-5xl mx-auto px-4 lg:px-6">
      
      {/* Header and View Selector Tab list */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1
            className="font-display text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {tab === 'quarter'
              ? `${t(`event.roles.quarter.Q${selectedQuarter}` as TranslationKey)} ${selectedYear}`
              : t(`event.roles.view.${tab}` as TranslationKey)}
          </h1>
          {isPending && (
            <p className="text-xs animate-pulse mt-0.5" style={{ color: 'var(--primary-default)' }}>
              {t('event.roles.updating' as TranslationKey)}
            </p>
          )}
        </div>

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="quarter">{t('event.roles.view.quarter')}</TabsTrigger>
            <TabsTrigger value="history">{t('event.roles.view.history')}</TabsTrigger>
            <TabsTrigger value="leaderboard">{t('event.roles.view.leaderboard')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Panel Content */}
      <Tabs value={tab}>
        {/* Quarterly tab content */}
        <TabsContent value="quarter" className="flex flex-col gap-6">
          {/* Quarter filters toolbar */}
          <div className="flex flex-wrap items-center gap-4 py-2 border-b pb-4 mb-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="w-32">
              <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs value={`Q${selectedQuarter}`} onValueChange={handleQuarterChange}>
              <TabsList>
                <TabsTrigger value="Q1">Q1</TabsTrigger>
                <TabsTrigger value="Q2">Q2</TabsTrigger>
                <TabsTrigger value="Q3">Q3</TabsTrigger>
                <TabsTrigger value="Q4">Q4</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {quarterEvents.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('event.rolesEmpty')}
            </p>
          ) : (
            <>
              {/* Desktop view */}
              <div className="hidden lg:block">
                <RolesTable
                  events={quarterEvents}
                  headers={headers}
                  currentTime={currentTime}
                  isCurrentQuarter={isCurrentQuarter}
                />
              </div>
              {/* Mobile view */}
              <div className="lg:hidden">
                <RolesCards
                  events={quarterEvents}
                  slotLabels={slotLabels}
                  currentTime={currentTime}
                  isCurrentQuarter={isCurrentQuarter}
                />
              </div>
            </>
          )}
        </TabsContent>

        {/* History tab content */}
        <TabsContent value="history">
          <HistoryPanel
            events={historyEvents}
            count={historyCount}
            page={historyPage}
            limit={historyLimit}
            search={historySearch}
          />
        </TabsContent>

        {/* Leaderboard tab content */}
        <TabsContent value="leaderboard">
          <LeaderboardPanel data={leaderboardData} />
        </TabsContent>
      </Tabs>
      
    </div>
  )
}
