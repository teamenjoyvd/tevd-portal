'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ApiError } from '@/lib/api-error'
import { formatDate, fromSofiaLocalInput } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { TranslationKey } from '@/lib/i18n'
import { fetchJson } from '@/lib/utils/fetchJson'

export type TicketProduct = {
  id: string
  kind: string
  seriesKey: string | null
  eventTitle: string | null
  entries: number
}

type IssuedPass = { id: string; unlock_code: string; holder_name: string; entries_total: number; expires_at: string }

const KIND_LABELS: Record<string, TranslationKey> = {
  single: 'admin.tickets.kind.single',
  pack: 'admin.tickets.kind.pack',
}
const SERIES_LABELS: Record<string, TranslationKey> = {
  tuesday: 'admin.tickets.series.tuesday',
  monday: 'admin.tickets.series.monday',
}

const INPUT_CLASS = 'w-full border rounded-xl px-3 py-2.5 text-sm'
const INPUT_STYLE = {
  borderColor: 'var(--border-default)',
  color: 'var(--text-primary)',
  backgroundColor: 'var(--bg-card)',
}

export function ComplimentaryPassForm({ products, onClose }: { products: TicketProduct[]; onClose: () => void }) {
  const { t } = useLanguage()
  const [productId, setProductId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [entries, setEntries] = useState('1')
  const [expires, setExpires] = useState('')

  const issue = useMutation({
    mutationFn: () =>
      fetchJson<IssuedPass>('/api/admin/tickets/complimentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          name,
          email,
          entries: Number(entries),
          // Valid through the chosen Sofia day.
          expires_at: fromSofiaLocalInput(`${expires}T23:59`),
        }),
      }),
  })

  const productLabel = (p: TicketProduct) => {
    const kind = KIND_LABELS[p.kind]
    const series = p.seriesKey !== null ? SERIES_LABELS[p.seriesKey] : undefined
    const covers = p.eventTitle ?? (series ? t(series) : p.seriesKey)
    return `${covers} · ${kind ? t(kind) : p.kind}`
  }

  const errorKey = (error: unknown): TranslationKey => {
    const code = error instanceof ApiError ? error.code : undefined
    if (code === 'invalid_input') return 'admin.tickets.comp.errorInput'
    if (code === 'not_found') return 'admin.tickets.comp.errorProduct'
    return 'admin.tickets.comp.error'
  }

  if (issue.data) {
    return (
      <div className="space-y-4" role="status">
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('admin.tickets.comp.done')}</p>
        <p className="font-mono text-2xl font-semibold tracking-widest" style={{ color: 'var(--text-primary)' }}>
          {issue.data.unlock_code}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.tickets.comp.holder')}: {issue.data.holder_name} · {t('admin.tickets.comp.entries')}:{' '}
          {issue.data.entries_total} · {t('admin.tickets.comp.expires')}: {formatDate(issue.data.expires_at)}
        </p>
      </div>
    )
  }

  const incomplete =
    productId === '' || name.trim() === '' || email.trim() === '' || expires === '' || !(Number(entries) >= 1)

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!incomplete && !issue.isPending) issue.mutate()
      }}
    >
      <div>
        <label htmlFor="comp-product" className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.tickets.comp.product')}
        </label>
        <Select
          value={productId}
          onValueChange={(id) => {
            setProductId(id)
            setEntries(String(products.find((p) => p.id === id)?.entries ?? 1))
          }}
        >
          <SelectTrigger id="comp-product"><SelectValue placeholder={t('admin.tickets.comp.pickProduct')} /></SelectTrigger>
          <SelectContent>
            {products.map((p) => <SelectItem key={p.id} value={p.id}>{productLabel(p)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label htmlFor="comp-name" className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.tickets.comp.name')}
        </label>
        <input id="comp-name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)}
          className={INPUT_CLASS} style={INPUT_STYLE} />
      </div>
      <div>
        <label htmlFor="comp-email" className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.tickets.comp.email')}
        </label>
        <input id="comp-email" type="email" required maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)}
          className={INPUT_CLASS} style={INPUT_STYLE} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="comp-entries" className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.tickets.comp.entries')}
          </label>
          <input id="comp-entries" type="number" required min={1} max={100} step={1} value={entries}
            onChange={(e) => setEntries(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
        </div>
        <div>
          <label htmlFor="comp-expires" className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.tickets.comp.expires')}
          </label>
          <input id="comp-expires" type="date" required value={expires} onChange={(e) => setExpires(e.target.value)}
            className={INPUT_CLASS} style={INPUT_STYLE} />
        </div>
      </div>
      {issue.isError && (
        <p className="text-sm" style={{ color: 'var(--status-alert-fg)' }} role="alert">{t(errorKey(issue.error))}</p>
      )}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={issue.isPending || incomplete}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-on-accent disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {issue.isPending ? t('admin.tickets.comp.saving') : t('admin.tickets.comp.submit')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-hover-surface"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {t('admin.tickets.comp.cancel')}
        </button>
      </div>
    </form>
  )
}
