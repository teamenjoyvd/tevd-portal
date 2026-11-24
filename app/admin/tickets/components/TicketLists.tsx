'use client'

import { useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiClient } from '@/lib/apiClient'
import { formatCurrency, formatDate, formatDateTime, fromSofiaLocalInput } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { TranslationKey } from '@/lib/i18n'
import type { AdminAdmission, AdminAdmissions, AdminAttention, AdminOrder, AdminPass, AdminSession } from '@/lib/server/tickets/admin-views'
import { INPUT_CLASS, INPUT_STYLE, SMALL_BUTTON, SMALL_STYLE, TicketAction, TICKETS_KEY } from './TicketAction'

/** Same limit as the server's ADMIN_ZOOM_ATTEMPTS. */
const MAX_ATTEMPTS = 3

const STATUS: Record<string, TranslationKey> = {
  active: 'admin.tickets.status.active',
  void: 'admin.tickets.status.void',
  pending_zoom: 'admin.tickets.status.pending_zoom',
  revoked: 'admin.tickets.status.revoked',
  pending: 'admin.tickets.status.pending',
  paid: 'admin.tickets.status.paid',
  expired: 'admin.tickets.status.expired',
}
const KIND: Record<string, TranslationKey> = { single: 'admin.tickets.kind.single', pack: 'admin.tickets.kind.pack' }
const SERIES: Record<string, TranslationKey> = { tuesday: 'admin.tickets.series.tuesday', monday: 'admin.tickets.series.monday' }

function useLabels() {
  const { t } = useLanguage()
  const from = (map: Record<string, TranslationKey>, key: string) => (map[key] !== undefined ? t(map[key]) : key)
  return { t, status: (s: string) => from(STATUS, s), kind: (k: string) => from(KIND, k), series: (s: string) => from(SERIES, s) }
}

function Card({ title, lines, children }: { title: string; lines: (string | null)[]; children?: ReactNode }) {
  return (
    <li className="border rounded-xl px-4 py-3 space-y-1" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
      <p className="text-sm font-semibold break-words" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {lines.map((line, i) =>
        line === null ? null : (
          <p key={i} className="text-sm break-words" style={{ color: 'var(--text-secondary)' }}>{line}</p>
        ),
      )}
      {children !== undefined && <div className="flex flex-wrap gap-2 pt-2">{children}</div>}
    </li>
  )
}

function List({ failed, empty, children }: { failed: boolean; empty: boolean; children: ReactNode }) {
  const { t } = useLanguage()
  if (failed) return <p className="text-sm" role="alert" style={{ color: 'var(--status-alert-fg)' }}>{t('tickets.err.failed')}</p>
  if (empty) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.tickets.none')}</p>
  return <ul className="space-y-3">{children}</ul>
}

function Search({ label, onSearch }: { label: string; onSearch: (q: string) => void }) {
  const { t } = useLanguage()
  const [text, setText] = useState('')
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(text)
      }}
    >
      <input aria-label={label} placeholder={label} maxLength={100} value={text} onChange={(e) => setText(e.target.value)}
        className={INPUT_CLASS} style={INPUT_STYLE} />
      <button type="submit" className={SMALL_BUTTON} style={SMALL_STYLE}>{t('tickets.door.search')}</button>
    </form>
  )
}

function useSearch<T>(view: 'passes' | 'orders') {
  const [q, setQ] = useState('')
  const query = useQuery<T[]>({
    queryKey: [TICKETS_KEY, view, q],
    queryFn: () => apiClient(`/api/admin/tickets/${view}`, { method: 'POST', body: JSON.stringify({ q }) }),
    placeholderData: keepPreviousData,
  })
  return { setQ, query }
}

function PassCard({ pass }: { pass: AdminPass }) {
  const { t, status, kind, series } = useLabels()
  const covers = pass.eventTitle ?? (pass.seriesKey !== null ? series(pass.seriesKey) : '')
  const path = (action: string) => `passes/${pass.id}/${action}`
  return (
    <Card
      title={`${pass.holder_name} · ${status(pass.status)}`}
      lines={[
        pass.holder_email === '' ? null : pass.holder_email,
        `${covers} · ${kind(pass.kind)}`,
        `${t('admin.tickets.used')}: ${pass.used} / ${pass.entries_total} · ${t('admin.tickets.comp.expires')}: ${formatDate(pass.expires_at)}`,
        `${t('admin.tickets.code')}: ${pass.unlock_code}`,
        pass.void_reason,
        pass.status === 'active' && pass.holder_email !== '' && pass.email_sent_at === null ? t('admin.tickets.emailNotSent') : null,
      ]}
    >
      {pass.status === 'active' && (
        <>
          {pass.holder_email !== '' && <TicketAction spec={{ path: path('resend'), label: 'admin.tickets.resend' }} />}
          <TicketAction spec={{
            path: path('email'), label: 'admin.tickets.email',
            input: { label: 'admin.tickets.email.label', type: 'email', body: (v) => ({ email: v.trim() }) },
          }} />
          <TicketAction spec={{
            path: path('expiry'), label: 'admin.tickets.expiry',
            // Valid through the chosen Sofia day.
            input: { label: 'admin.tickets.comp.expires', type: 'date', body: (v) => ({ expires_at: fromSofiaLocalInput(`${v}T23:59`) }) },
          }} />
          <TicketAction spec={{ path: path('reissue'), label: 'admin.tickets.reissue', confirm: t('admin.tickets.reissue.confirm') }} />
          <TicketAction spec={{
            path: path('void'), label: 'admin.tickets.void', confirm: t('admin.tickets.void.confirm'),
            input: { label: 'admin.tickets.void.label', type: 'text', body: (v) => ({ reason: v }) },
          }} />
        </>
      )}
    </Card>
  )
}

export function PassesTab() {
  const { t } = useLanguage()
  const { setQ, query } = useSearch<AdminPass>('passes')
  return (
    <div className="space-y-4">
      <Search label={t('admin.tickets.searchPasses')} onSearch={setQ} />
      <List failed={query.isError} empty={query.data?.length === 0}>
        {query.data?.map((p) => <PassCard key={p.id} pass={p} />)}
      </List>
      <TicketAction spec={{
        path: 'anonymise', label: 'admin.tickets.anonymise', confirm: t('admin.tickets.anonymise.confirm'),
        input: { label: 'admin.tickets.anonymise.label', type: 'email', body: (v) => ({ email: v.trim() }) },
      }} />
    </div>
  )
}

export function OrdersTab() {
  const { t, status, kind } = useLabels()
  const { setQ, query } = useSearch<AdminOrder>('orders')
  return (
    <div className="space-y-4">
      <Search label={t('admin.tickets.searchOrders')} onSearch={setQ} />
      <List failed={query.isError} empty={query.data?.length === 0}>
        {query.data?.map((o) => (
          <Card
            key={o.id}
            title={`${o.buyer_name} · ${status(o.status)}`}
            lines={[
              o.buyer_email,
              `${kind(o.ticket_products?.kind ?? '')} · ${formatCurrency(o.total_cents / 100, o.currency.toUpperCase())}`,
              formatDateTime(o.created_at),
              o.door_event_id === null ? null : t('admin.tickets.door'),
            ]}
          />
        ))}
      </List>
    </div>
  )
}

function AdmissionCard({ admission: a, showEvent = false, started }: { admission: AdminAdmission; showEvent?: boolean; started: boolean }) {
  const { t, status } = useLabels()
  const usedUp = a.zoom_attempts >= MAX_ATTEMPTS
  const path = (action: string) => `admissions/${a.id}/${action}`
  const online = a.mode === 'online'
  return (
    <Card
      title={`${a.attendee_name} · ${status(a.status)}`}
      lines={[
        showEvent ? `${a.eventTitle} · ${formatDateTime(a.eventStart)}` : null,
        a.attendee_email,
        `${t(online ? 'admin.tickets.mode.online' : 'admin.tickets.mode.in_person')} · ${formatDateTime(a.checked_in_at ?? a.created_at)}`,
        online ? `${t('admin.tickets.attempts')}: ${a.zoom_attempts} / ${MAX_ATTEMPTS}` : null,
        a.zoomCancelFailed ? t('admin.tickets.stillInZoom') : null,
      ]}
    >
      {a.status === 'pending_zoom' && (
        <TicketAction disabled={usedUp} hint={t('admin.tickets.err.attempts_used')} spec={{ path: path('retry'), label: 'admin.tickets.retry' }} />
      )}
      {a.status !== 'revoked' && online && !started && (
        <TicketAction disabled={usedUp} hint={t('admin.tickets.err.attempts_used')} spec={{
          path: path('rename'), label: 'admin.tickets.rename',
          input: { label: 'admin.tickets.rename.label', type: 'text', body: (v) => ({ name: v }) },
        }} />
      )}
      {a.status !== 'revoked' && (
        <TicketAction spec={{ path: path('revoke'), label: 'admin.tickets.revoke', confirm: t('admin.tickets.revoke.confirm') }} />
      )}
      {a.zoomCancelFailed && <TicketAction spec={{ path: path('cancel-zoom'), label: 'admin.tickets.cancelZoom' }} />}
    </Card>
  )
}

export function SessionsTab() {
  const { t } = useLanguage()
  const [id, setId] = useState('')
  const [openedAt] = useState(() => Date.now())
  const sessions = useQuery<AdminSession[]>({
    queryKey: [TICKETS_KEY, 'sessions'],
    queryFn: () => apiClient('/api/admin/tickets/sessions'),
  })
  const detail = useQuery<AdminAdmissions>({
    queryKey: [TICKETS_KEY, 'admissions', id],
    queryFn: () => apiClient(`/api/admin/tickets/sessions?event_id=${id}`),
    enabled: id !== '',
  })
  const session = sessions.data?.find((s) => s.id === id)
  const preview = useQuery<{ passes: number; admissions: number }>({
    queryKey: [TICKETS_KEY, 'cancel-preview', id],
    queryFn: () => apiClient(`/api/admin/tickets/sessions/${id}/cancel`),
    enabled: session !== undefined && !session.cancelled,
  })
  const of = (n: number, cap: number | null) => (cap === null ? String(n) : `${n} / ${cap}`)

  return (
    <div className="space-y-4">
      {sessions.isError && <p className="text-sm" role="alert" style={{ color: 'var(--status-alert-fg)' }}>{t('tickets.err.failed')}</p>}
      <Select value={id} onValueChange={setId}>
        <SelectTrigger aria-label={t('admin.tickets.pickSession')}><SelectValue placeholder={t('admin.tickets.pickSession')} /></SelectTrigger>
        <SelectContent>
          {sessions.data?.map((s) => <SelectItem key={s.id} value={s.id}>{`${formatDateTime(s.start_time)} · ${s.title}`}</SelectItem>)}
        </SelectContent>
      </Select>
      {session !== undefined && detail.data !== undefined && (
        <>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {t('admin.tickets.mode.online')}: {of(detail.data.online, detail.data.onlineCapacity)} ·{' '}
            {t('admin.tickets.mode.in_person')}: {of(detail.data.inPerson, detail.data.inPersonCapacity)}
            {session.cancelled ? ` · ${t('admin.tickets.status.cancelled')}` : ''}
          </p>
          {!session.cancelled && (
            <TicketAction disabled={preview.data === undefined} spec={{
              path: `sessions/${session.id}/cancel`, label: 'admin.tickets.cancelSession',
              confirm: t('admin.tickets.cancelSession.confirm')
                .replace('{{a}}', String(preview.data?.admissions ?? ''))
                .replace('{{p}}', String(preview.data?.passes ?? '')),
            }} />
          )}
        </>
      )}
      {id !== '' && (
        <List failed={detail.isError} empty={detail.data?.admissions.length === 0}>
          {detail.data?.admissions.map((a) => (
            <AdmissionCard key={a.id} admission={a} started={openedAt >= Date.parse(a.eventStart)} />
          ))}
        </List>
      )}
    </div>
  )
}

export function AttentionTab() {
  const { t } = useLanguage()
  const [openedAt] = useState(() => Date.now())
  const query = useQuery<AdminAttention>({
    queryKey: [TICKETS_KEY, 'attention'],
    queryFn: () => apiClient('/api/admin/tickets/attention'),
  })
  const admissions = (title: TranslationKey, rows: AdminAdmission[] | undefined) => (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t(title)}</h2>
      <List failed={query.isError} empty={rows?.length === 0}>
        {rows?.map((a) => <AdmissionCard key={a.id} admission={a} showEvent started={openedAt >= Date.parse(a.eventStart)} />)}
      </List>
    </section>
  )
  return (
    <div className="space-y-6">
      {admissions('admin.tickets.stuck', query.data?.stuck)}
      {admissions('admin.tickets.stillInZoomTitle', query.data?.stillInZoom)}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('admin.tickets.failedEmails')}</h2>
        <List failed={query.isError} empty={query.data?.failedEmails.length === 0}>
          {query.data?.failedEmails.map((p) => <PassCard key={p.id} pass={p} />)}
        </List>
      </section>
    </div>
  )
}
