'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import QRCode from 'qrcode'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, ApiError } from '@/lib/apiClient'
import { formatDate, formatTime } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { TranslationKey } from '@/lib/i18n'
import type { DoorEntry, DoorEvent, DoorMatch, DoorPass } from '@/lib/server/tickets/door'

const CameraScanner = dynamic(() => import('./CameraScanner'), { ssr: false })

type Via = 'qr' | 'code' | 'search'
type Lookup = { via: Via; key: { qr: string } | { code: string } | { pass_id: string } }
type Panel = 'scan' | 'search' | 'walkIn' | 'sell'

const INPUT = 'w-full border rounded-xl px-3 py-2.5 text-base sm:text-sm'
const INPUT_STYLE = { borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }
const BUTTON = 'w-full px-6 py-3 rounded-xl text-sm font-semibold text-on-accent disabled:opacity-40'
const BUTTON_STYLE = { backgroundColor: 'var(--brand-crimson)', minHeight: 44 }

const ERROR_KEYS: Record<string, TranslationKey> = {
  invalid_input: 'tickets.door.invalid',
  not_found: 'tickets.err.not_found',
  void: 'tickets.err.void',
  expired: 'tickets.err.expired',
  outside_window: 'tickets.door.closed',
  no_entries: 'tickets.err.no_entries',
  full: 'tickets.door.full',
  cancelled: 'tickets.err.cancelled',
  not_covered: 'tickets.err.not_covered',
  not_ticketed: 'tickets.err.not_covered',
}
const COLORS = {
  green: { backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-fg)' },
  amber: { backgroundColor: 'var(--status-pending-bg)', color: 'var(--status-pending-fg)' },
  red: { backgroundColor: 'var(--status-alert-bg)', color: 'var(--status-alert-fg)' },
} as const

const errorKey = (err: unknown): TranslationKey =>
  (err instanceof ApiError && err.code !== undefined ? ERROR_KEYS[err.code] : undefined) ?? 'tickets.err.failed'
const post = <T,>(path: string, body: object) =>
  apiClient<T>(`/api/admin/scanner/${path}`, { method: 'POST', body: JSON.stringify(body) })

function Alert({ text }: { text: string }) {
  return <p className="text-sm" role="alert" style={{ color: 'var(--status-alert-fg)' }}>{text}</p>
}

export function ScannerClient({ events }: { events: DoorEvent[] }) {
  const { t } = useLanguage()
  const [eventId, setEventId] = useState(events.length === 1 ? events[0].id : null)
  const event = events.find((e) => e.id === eventId)

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 space-y-4">
      <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tickets.door.title')}</h1>
      {events.length === 0 && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('tickets.door.noEvents')}</p>}
      {event === undefined ? (
        events.map((e) => (
          <button key={e.id} type="button" onClick={() => setEventId(e.id)} className="block w-full text-left border rounded-xl px-4 py-3 text-sm"
            style={{ ...INPUT_STYLE, minHeight: 44 }}>
            {formatTime(e.start_time)} · {e.title}
          </button>
        ))
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold min-w-0 break-words" style={{ color: 'var(--text-primary)' }}>
              {formatTime(event.start_time)} · {event.title}
            </p>
            {events.length > 1 && (
              <button type="button" onClick={() => setEventId(null)} className="text-sm underline flex-shrink-0"
                style={{ color: 'var(--text-secondary)', minHeight: 44 }}>
                {t('tickets.door.change')}
              </button>
            )}
          </div>
          <Door key={event.id} event={event} />
        </>
      )}
    </div>
  )
}

function Door({ event }: { event: DoorEvent }) {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [panel, setPanel] = useState<Panel>('scan')
  const [via, setVia] = useState<Via>('code')
  const [done, setDone] = useState<number | null>(null)
  const listKey = ['door-list', event.id]
  const list = useQuery<DoorEntry[]>({
    queryKey: listKey,
    queryFn: () => apiClient(`/api/admin/scanner/lookup?event_id=${event.id}`),
    // Someone who pays at the door appears by themself.
    refetchInterval: 10_000,
  })
  const lookup = useMutation({
    mutationFn: ({ key }: Lookup) => post<{ pass: DoorPass }>('lookup', { event_id: event.id, ...key }),
  })
  const find = (next: Lookup) => {
    setDone(null)
    setVia(next.via)
    lookup.mutate(next)
  }
  const admitted = (count: number) => {
    lookup.reset()
    setDone(count)
    setPanel('scan')
    qc.invalidateQueries({ queryKey: listKey })
  }
  const open = (next: Panel) => {
    lookup.reset()
    setDone(null)
    setPanel(next)
  }

  const panels: { id: Panel; label: TranslationKey }[] = [
    { id: 'scan', label: 'tickets.door.scan' },
    { id: 'search', label: 'tickets.door.search' },
    ...(event.free ? [{ id: 'walkIn', label: 'tickets.door.walkIn' } as const] : []),
    ...(event.selling ? [{ id: 'sell', label: 'tickets.door.sell' } as const] : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {panels.map((p) => (
          <button key={p.id} type="button" aria-pressed={panel === p.id} onClick={() => open(p.id)}
            className="px-3 py-2 rounded-xl border text-sm font-semibold"
            style={{ ...INPUT_STYLE, minHeight: 44, borderColor: panel === p.id ? 'var(--brand-crimson)' : 'var(--border-default)' }}>
            {t(p.label)}
          </button>
        ))}
      </div>

      {done !== null && (
        <p className="text-sm font-semibold rounded-xl px-4 py-3" role="status" style={COLORS.green}>
          {t('tickets.door.done').replace('{{n}}', String(done))}
        </p>
      )}

      {lookup.data !== undefined ? (
        <PassPanel key={lookup.data.pass.passId} eventId={event.id} via={via} pass={lookup.data.pass} onAdmitted={admitted}
          onClose={() => lookup.reset()} />
      ) : (
        <>
          {lookup.isError && <Alert text={t(errorKey(lookup.error))} />}
          {panel === 'scan' && <ScanPanel pending={lookup.isPending} onFind={find} />}
          {panel === 'search' && <SearchPanel eventId={event.id} onFind={find} />}
          {panel === 'walkIn' && <WalkInPanel eventId={event.id} onAdmitted={admitted} />}
          {panel === 'sell' && <SellPanel eventId={event.id} />}
        </>
      )}

      <section className="space-y-1">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('tickets.door.inside')}{list.data === undefined ? '' : `: ${list.data.length}`}
        </h2>
        {list.isError && <Alert text={t('tickets.err.failed')} />}
        <Entries entries={list.data ?? []} />
      </section>
    </div>
  )
}

function Entries({ entries }: { entries: DoorEntry[] }) {
  return entries.map((e, i) => (
    <p key={`${e.at}-${i}`} className="text-sm break-words" style={{ color: 'var(--text-primary)' }}>
      {formatTime(e.at)} · {e.name}{e.staff ? ` · ${e.staff}` : ''}
    </p>
  ))
}

function Form({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form className="space-y-3" onSubmit={(e: FormEvent) => {
      e.preventDefault()
      onSubmit()
    }}>
      {children}
    </form>
  )
}

function ScanPanel({ pending, onFind }: { pending: boolean; onFind: (l: Lookup) => void }) {
  const { t } = useLanguage()
  const [camera, setCamera] = useState(false)
  const [code, setCode] = useState('')
  return (
    <div className="space-y-4">
      {camera ? (
        <CameraScanner onScan={(qr) => {
          setCamera(false)
          onFind({ via: 'qr', key: { qr: qr.slice(0, 200) } })
        }} />
      ) : (
        <button type="button" disabled={pending} onClick={() => setCamera(true)} className={BUTTON} style={BUTTON_STYLE}>
          {t('tickets.door.camera')}
        </button>
      )}
      <Form onSubmit={() => { if (!pending) onFind({ via: 'code', key: { code: code.trim() } }) }}>
        <input aria-label={t('tickets.code.label')} placeholder={t('tickets.code.label')} required minLength={8} maxLength={10} autoComplete="off"
          autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)}
          className={`${INPUT} font-mono uppercase tracking-widest`} style={INPUT_STYLE} />
        <button type="submit" disabled={pending} className={BUTTON} style={BUTTON_STYLE}>{t('tickets.code.next')}</button>
      </Form>
    </div>
  )
}

function SearchPanel({ eventId, onFind }: { eventId: string; onFind: (l: Lookup) => void }) {
  const { t } = useLanguage()
  const [text, setText] = useState('')
  const search = useMutation({ mutationFn: () => post<{ matches: DoorMatch[] }>('lookup', { event_id: eventId, search: text }) })
  return (
    <div className="space-y-3">
      <Form onSubmit={() => { if (!search.isPending) search.mutate() }}>
        <input aria-label={t('tickets.door.searchLabel')} placeholder={t('tickets.door.searchLabel')} required minLength={3} maxLength={100}
          value={text} onChange={(e) => setText(e.target.value)} className={INPUT} style={INPUT_STYLE} />
        <button type="submit" disabled={search.isPending} className={BUTTON} style={BUTTON_STYLE}>{t('tickets.door.search')}</button>
      </Form>
      {search.isError && <Alert text={t(errorKey(search.error))} />}
      {search.data?.matches.length === 0 && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('tickets.door.noMatch')}</p>}
      {search.data !== undefined && search.data.matches.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('tickets.door.checkName')}</p>
      )}
      {search.data?.matches.map((m) => (
        <button key={m.passId} type="button" onClick={() => onFind({ via: 'search', key: { pass_id: m.passId } })}
          className="block w-full text-left border rounded-xl px-4 py-3 text-sm break-words" style={{ ...INPUT_STYLE, minHeight: 44 }}>
          {m.holder} · {m.email}
        </button>
      ))}
    </div>
  )
}

function WalkInPanel({ eventId, onAdmitted }: { eventId: string; onAdmitted: (count: number) => void }) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const register = useMutation({
    mutationFn: () => post('walk-in', { event_id: eventId, name, email: email.trim() }),
    onSuccess: () => onAdmitted(1),
  })
  return (
    <Form onSubmit={() => { if (!register.isPending) register.mutate() }}>
      <input aria-label={t('tickets.code.guestName')} placeholder={t('tickets.code.guestName')} required minLength={2} maxLength={200}
        value={name} onChange={(e) => setName(e.target.value)} className={INPUT} style={INPUT_STYLE} />
      <input aria-label={t('tickets.door.emailOptional')} placeholder={t('tickets.door.emailOptional')} type="email" maxLength={320}
        value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} style={INPUT_STYLE} />
      {register.isError && <Alert text={t(errorKey(register.error))} />}
      <button type="submit" disabled={register.isPending} className={BUTTON} style={BUTTON_STYLE}>{t('tickets.door.admit')}</button>
    </Form>
  )
}

function SellPanel({ eventId }: { eventId: string }) {
  const { t } = useLanguage()
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    QRCode.toDataURL(`${window.location.origin}/events/${eventId}/buy?door=1`, { width: 640, margin: 2 }).then(
      (url) => { if (current) setQr(url) },
      () => {},
    )
    return () => { current = false }
  }, [eventId])
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('tickets.door.sellIntro')}</p>
      {qr !== null && <Image src={qr} alt={t('tickets.door.sell')} width={300} height={300} unoptimized className="mx-auto" />}
    </div>
  )
}

function PassPanel({ eventId, via, pass, onAdmitted, onClose }: {
  eventId: string
  via: Via
  pass: DoorPass
  onAdmitted: (count: number) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const [names, setNames] = useState([pass.admitted.length === 0 ? pass.holder : ''])
  const admit = useMutation({
    mutationFn: () => post<{ admitted: number }>('redeem', { event_id: eventId, pass_id: pass.passId, via, names }),
    onSuccess: (r) => onAdmitted(r.admitted),
  })
  const title: TranslationKey =
    pass.color === 'green' ? 'tickets.door.valid'
    : pass.color === 'amber' ? 'tickets.door.allIn'
    : pass.reason === 'no_entries' ? 'tickets.door.usedUp'
    : ERROR_KEYS[pass.reason ?? ''] ?? 'tickets.err.failed'

  return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-4 space-y-1" role="status" style={COLORS[pass.color]}>
        <p className="text-lg font-semibold">{t(title)}</p>
        <p className="text-sm break-words">{pass.holder}</p>
        <p className="text-sm">
          {t('tickets.mine.left')}: {pass.entriesLeft} / {pass.entriesTotal} · {t('admin.tickets.comp.expires')}: {formatDate(pass.expiresAt)}
        </p>
      </div>
      {pass.admitted.length > 0 && (
        <div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('tickets.code.admitted')}</p>
          <Entries entries={pass.admitted} />
        </div>
      )}
      {pass.color === 'green' && (
        <Form onSubmit={() => { if (!admit.isPending) admit.mutate() }}>
          {names.map((name, i) => (
            <input key={i} aria-label={t('tickets.code.guestName')} placeholder={t('tickets.code.guestName')} required maxLength={200}
              value={name} onChange={(e) => setNames((all) => all.map((n, j) => (j === i ? e.target.value : n)))}
              className={INPUT} style={INPUT_STYLE} />
          ))}
          <div className="flex gap-4">
            {names.length < pass.entriesLeft && (
              <button type="button" onClick={() => setNames((all) => [...all, ''])} className="text-sm font-semibold underline"
                style={{ color: 'var(--text-primary)', minHeight: 44 }}>{t('tickets.code.addGuest')}</button>
            )}
            {names.length > 1 && (
              <button type="button" onClick={() => setNames((all) => all.slice(0, -1))} className="text-sm underline"
                style={{ color: 'var(--text-secondary)', minHeight: 44 }}>{t('tickets.code.removeGuest')}</button>
            )}
          </div>
          {admit.isError && <Alert text={t(errorKey(admit.error))} />}
          <button type="submit" disabled={admit.isPending} className={BUTTON} style={BUTTON_STYLE}>
            {t('tickets.door.admit')} ({names.length})
          </button>
        </Form>
      )}
      <button type="button" onClick={onClose} className="text-sm underline" style={{ color: 'var(--text-secondary)', minHeight: 44 }}>
        {t('tickets.door.next')}
      </button>
    </div>
  )
}
