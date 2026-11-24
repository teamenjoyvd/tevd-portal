'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ApiError } from '@/lib/api-error'
import { formatDateTime } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { TranslationKey } from '@/lib/i18n'
import { fetchJson } from '@/lib/utils/fetchJson'

export type ZoomSeriesOptions = { configured: boolean; series_keys: string[] }

type LinkResult = {
  created: number
  updated: number
  future: number
  vanished: { id: string; title: string; start_time: string }[]
}

const SERIES_LABELS: Record<string, TranslationKey> = {
  tuesday: 'admin.tickets.series.tuesday',
  monday: 'admin.tickets.series.monday',
}
const EVENT_TYPES = [
  ['hybrid', 'admin.zoom.type.hybrid'],
  ['online', 'admin.zoom.type.online'],
  ['in-person', 'admin.zoom.type.inPerson'],
] as const satisfies readonly (readonly [string, TranslationKey])[]
const ERROR_KEYS: Record<string, TranslationKey> = {
  not_recurring: 'admin.zoom.error.notRecurring',
  wrong_settings: 'admin.zoom.error.wrongSettings',
  other_series: 'admin.zoom.error.otherSeries',
  not_allowed: 'admin.zoom.error.notAllowed',
  not_found: 'admin.zoom.error.notFound',
  invalid_input: 'admin.zoom.error.input',
}

const INPUT_CLASS = 'w-full border rounded-xl px-3 py-2.5 text-sm'
const INPUT_STYLE = {
  borderColor: 'var(--border-default)',
  color: 'var(--text-primary)',
  backgroundColor: 'var(--bg-card)',
}

const capacity = (value: string) => (value === '' ? null : Number(value))

export function LinkZoomSeriesForm({ seriesKeys, onClose }: { seriesKeys: string[]; onClose: () => void }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [seriesKey, setSeriesKey] = useState('')
  const [zoomId, setZoomId] = useState('')
  const [eventType, setEventType] = useState<string>('hybrid')
  const [inPerson, setInPerson] = useState('')
  const [online, setOnline] = useState('100')

  const link = useMutation({
    mutationFn: () =>
      fetchJson<LinkResult>('/api/admin/zoom/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          series_key: seriesKey,
          zoom_id: zoomId,
          event_type: eventType,
          in_person_capacity: capacity(inPerson),
          online_capacity: capacity(online),
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-calendar'] }),
  })

  const errorKey = (error: unknown): TranslationKey =>
    (error instanceof ApiError && error.code !== undefined ? ERROR_KEYS[error.code] : undefined) ?? 'admin.zoom.error'

  if (link.data) {
    return (
      <div className="space-y-4" role="status">
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
          {t('admin.zoom.done')
            .replace('{{created}}', String(link.data.created))
            .replace('{{updated}}', String(link.data.updated))
            .replace('{{future}}', String(link.data.future))}
        </p>
        {link.data.vanished.length > 0 && (
          <div className="text-sm space-y-1" style={{ color: 'var(--status-alert-fg)' }}>
            <p>{t('admin.zoom.vanished')}</p>
            <ul className="list-disc pl-5">
              {link.data.vanished.map((v) => <li key={v.id}>{v.title} · {formatDateTime(v.start_time)}</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const incomplete = seriesKey === '' || zoomId.trim() === ''
  const label = (htmlFor: string, key: TranslationKey) => (
    <label htmlFor={htmlFor} className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t(key)}</label>
  )

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!incomplete && !link.isPending) link.mutate()
      }}
    >
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.zoom.intro')}</p>
      <div>
        {label('zoom-series', 'admin.zoom.series')}
        <Select value={seriesKey} onValueChange={setSeriesKey}>
          <SelectTrigger id="zoom-series"><SelectValue placeholder={t('admin.zoom.pickSeries')} /></SelectTrigger>
          <SelectContent>
            {seriesKeys.map((key) => {
              const known = SERIES_LABELS[key]
              return <SelectItem key={key} value={key}>{known ? t(known) : key}</SelectItem>
            })}
          </SelectContent>
        </Select>
      </div>
      <div>
        {label('zoom-id', 'admin.zoom.id')}
        <input id="zoom-id" required inputMode="numeric" maxLength={20} value={zoomId}
          onChange={(e) => setZoomId(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
      </div>
      <div>
        {label('zoom-type', 'admin.zoom.type')}
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger id="zoom-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map(([value, key]) => <SelectItem key={value} value={value}>{t(key)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          {label('zoom-in-person', 'admin.zoom.inPersonCapacity')}
          <input id="zoom-in-person" type="number" min={0} step={1} value={inPerson}
            onChange={(e) => setInPerson(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
        </div>
        <div>
          {label('zoom-online', 'admin.zoom.onlineCapacity')}
          <input id="zoom-online" type="number" min={0} max={100} step={1} value={online}
            onChange={(e) => setOnline(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
        </div>
      </div>
      {link.isError && (
        <p className="text-sm" style={{ color: 'var(--status-alert-fg)' }} role="alert">{t(errorKey(link.error))}</p>
      )}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button type="submit" disabled={link.isPending || incomplete}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-on-accent disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {link.isPending ? t('admin.zoom.saving') : t('admin.zoom.submit')}
        </button>
        <button type="button" onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-hover-surface"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          {t('admin.tickets.comp.cancel')}
        </button>
      </div>
    </form>
  )
}
