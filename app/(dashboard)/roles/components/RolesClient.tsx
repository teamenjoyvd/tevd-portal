'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatDate, formatTime } from '@/lib/format'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { RoleEvent } from '@/lib/roles/types'
import { Database } from '@/types/supabase'
import { cn } from '@/lib/utils'
import History from './History'

type Props = {
  tab: 'quarter' | 'history'
  selectedYear: number
  selectedQuarter: number
  currentYear: number
  currentQuarter: number
  currentTime: string
  quarterEvents: RoleEvent[]
  participationHistoryData: Database['public']['Views']['member_roles_history']['Row'][]
  eventYears: number[]
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
  participationHistoryData,
  eventYears,
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

  // Generate Year options by merging selectedYear and eventYears
  const yearOptions = Array.from(new Set([selectedYear, ...(eventYears || [])])).sort((a, b) => b - a)

  function handleHistoryToggle() {
    const nextTab = tab === 'history' ? 'quarter' : 'history'
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
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
      
      {/* View Selector Controls Row */}
      <div className="flex items-center justify-between gap-4 mb-8">
        
        {/* Left Cluster: Year and Quarter select (visible only when tab !== 'history') */}
        {tab !== 'history' ? (
          <div className="flex items-center gap-2">
            <div className="w-16">
              <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                <SelectTrigger className="w-16 h-8 px-2 text-xs">
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
              <TabsList className="h-8 p-0.5 gap-0.5">
                <TabsTrigger value="Q1" className="w-9 h-7 px-0 text-xs">Q1</TabsTrigger>
                <TabsTrigger value="Q2" className="w-9 h-7 px-0 text-xs">Q2</TabsTrigger>
                <TabsTrigger value="Q3" className="w-9 h-7 px-0 text-xs">Q3</TabsTrigger>
                <TabsTrigger value="Q4" className="w-9 h-7 px-0 text-xs">Q4</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        ) : (
          <div />
        )}

        {/* Right Toggle Button: History */}
        <button
          onClick={handleHistoryToggle}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-lg',
            'h-8 px-3 text-xs font-medium transition-all cursor-pointer',
            tab === 'history'
              ? 'bg-[var(--bg-global)] text-[var(--text-primary)] shadow-sm border border-[var(--border-default)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          )}
        >
          {t('event.roles.view.history')}
        </button>
      </div>

      {isPending && (
        <p className="text-xs animate-pulse mb-4" style={{ color: 'var(--primary-default)' }}>
          {t('event.roles.updating')}
        </p>
      )}

      {/* Main Panel Content */}
      {tab === 'quarter' ? (
        quarterEvents.length === 0 ? (
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
        )
      ) : (
        <History data={participationHistoryData} />
      )}
      
    </div>
  )
}
