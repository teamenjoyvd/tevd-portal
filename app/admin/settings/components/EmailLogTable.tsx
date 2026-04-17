'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '@/lib/i18n/useTranslation'

// ── Types ────────────────────────────────────────────────────────────────────

type EmailLogRow = {
  id: string
  template: string
  recipient: string
  status: string
  error: string | null
  resend_id: string | null
  created_at: string
  sent_at: string | null
  payload: Record<string, unknown>
}

type LogsResponse = {
  rows: EmailLogRow[]
  total: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusPill(status: string) {
  if (status === 'sent') return { bg: '#81b29a33', color: '#2d6a4f' }
  if (status === 'failed') return { bg: 'rgba(188,71,73,0.1)', color: 'var(--brand-crimson)' }
  return { bg: '#f2cc8f33', color: '#7a5c00' }
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

const PAGE_SIZE = 20

const TEMPLATE_LABELS: Record<string, string> = {
  welcome: 'Welcome',
  payment_status: 'Payment Status',
  document_expiring_soon: 'Doc Expiry',
  doc_expiry: 'Doc Expiry',
  abo_verification_result: 'ABO Verification',
  trip_registration_status: 'Trip Registration',
  event_role_request_result: 'Event Role',
  trip_registration_cancelled: 'Trip Cancelled',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EmailLogTable() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed' | 'pending'>('all')
  const [templateFilter, setTemplateFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(templateFilter !== 'all' && { template: templateFilter }),
  })

  const { data, isLoading } = useQuery<LogsResponse>({
    queryKey: ['email-log', statusFilter, templateFilter, page],
    queryFn: () => fetch(`/api/admin/email-log?${params}`).then(r => r.json()),
    staleTime: 30_000,
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const retryMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/settings/email/retry/${id}`, { method: 'POST' }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Retry failed')
        return r.json()
      }),
    onMutate: (id) => { setRetryingId(id); setRetryError(null) },
    onSettled: () => setRetryingId(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-log'] }),
    onError: (e: Error) => setRetryError(e.message),
  })

  const STATUS_FILTERS = [
    { key: 'all' as const, labelKey: 'admin.settings.emailLog.filter.all' as const },
    { key: 'sent' as const, labelKey: 'admin.settings.emailLog.filter.sent' as const },
    { key: 'failed' as const, labelKey: 'admin.settings.emailLog.filter.failed' as const },
    { key: 'pending' as const, labelKey: 'admin.settings.emailLog.filter.pending' as const },
  ]

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-5 w-full shadow-sm flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-[var(--semantic-fg-primary)] tracking-tight">
          {t('admin.settings.emailLog.title')}
        </h2>
        <p className="text-xs text-[var(--semantic-fg-secondary)]">
          {t('admin.settings.emailLog.desc')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map(s => (
            <button
              key={s.key}
              onClick={() => { setStatusFilter(s.key); setPage(0) }}
              className="px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all"
              style={{
                backgroundColor: statusFilter === s.key ? 'var(--semantic-fg-primary)' : 'rgba(0,0,0,0.06)',
                color: statusFilter === s.key ? 'var(--bg-card)' : 'var(--semantic-fg-secondary)',
              }}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>

        <select
          value={templateFilter}
          onChange={e => { setTemplateFilter(e.target.value); setPage(0) }}
          className="ml-auto text-xs border rounded-lg px-2.5 py-1.5 h-8"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--semantic-fg-primary)',
          }}
        >
          <option value="all">{t('admin.settings.emailLog.allTemplates')}</option>
          {Object.entries(TEMPLATE_LABELS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      {retryError && (
        <p className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {t('admin.settings.emailLog.retryError')} {retryError}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--semantic-fg-secondary)] py-4 text-center">{t('admin.settings.emailLog.empty')}</p>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
          <div
            className="hidden md:grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-4 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ backgroundColor: 'rgba(0,0,0,0.03)', color: 'var(--semantic-fg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}
          >
            <span>{t('admin.settings.emailLog.col.template')}</span>
            <span>{t('admin.settings.emailLog.col.recipient')}</span>
            <span>{t('admin.settings.emailLog.col.sentAt')}</span>
            <span>{t('admin.settings.emailLog.col.status')}</span>
            <span></span>
          </div>

          {rows.map((row, i) => {
            const pill = statusPill(row.status)
            return (
              <div
                key={row.id}
                className="px-4 py-3 flex flex-col md:grid md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-center gap-2 md:gap-4"
                style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-[var(--semantic-fg-primary)]">
                    {TEMPLATE_LABELS[row.template] ?? row.template}
                  </span>
                  {row.error && (
                    <span className="text-[10px] text-red-600 leading-tight line-clamp-2">{row.error}</span>
                  )}
                </div>
                <span className="text-xs text-[var(--semantic-fg-secondary)] truncate">{row.recipient}</span>
                <span className="text-xs text-[var(--semantic-fg-tertiary)]">
                  {row.sent_at ? formatDate(row.sent_at) : formatDate(row.created_at)}
                </span>
                <span
                  className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap w-fit"
                  style={{ backgroundColor: pill.bg, color: pill.color }}
                >
                  {row.status}
                </span>
                <div className="flex justify-end">
                  {row.status === 'failed' && (
                    <button
                      disabled={retryingId === row.id}
                      onClick={() => retryMutation.mutate(row.id)}
                      className="text-xs font-semibold px-3 py-1 rounded-lg border transition-colors hover:bg-black/5 disabled:opacity-40"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--semantic-fg-primary)' }}
                    >
                      {retryingId === row.id ? t('admin.settings.emailLog.btn.retrying') : t('admin.settings.emailLog.btn.retry')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[var(--semantic-fg-tertiary)]">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-40 transition-colors hover:bg-black/5"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--semantic-fg-primary)' }}
            >
              {t('admin.settings.emailLog.pagination.prev')}
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-40 transition-colors hover:bg-black/5"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--semantic-fg-primary)' }}
            >
              {t('admin.settings.emailLog.pagination.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
