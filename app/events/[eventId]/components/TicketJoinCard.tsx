'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { confirmDeviceCode, joinAdmission, requestDeviceCode, type TicketError } from '@/lib/actions/tickets'
import { t as translate, type TranslationKey } from '@/lib/i18n'

export const INPUT_CLASS = 'w-full border rounded-xl px-3 py-2.5 text-base sm:text-sm'
export const INPUT_STYLE = { borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }
export const BUTTON_CLASS =
  'w-full px-6 py-3 rounded-xl text-sm font-semibold text-on-accent disabled:opacity-40 hover:opacity-90 transition-opacity'
export const BUTTON_STYLE = { backgroundColor: 'var(--brand-crimson)', minHeight: 44 }

const ERROR_KEYS: Record<TicketError, TranslationKey> = {
  invalid_input: 'tickets.err.invalid_input',
  rate_limited: 'tickets.err.rate_limited',
  not_found: 'tickets.err.not_found',
  void: 'tickets.err.void',
  expired: 'tickets.err.expired',
  outside_window: 'tickets.err.outside_window',
  no_entries: 'tickets.err.no_entries',
  full: 'tickets.err.full',
  duplicate_email: 'tickets.err.duplicate_email',
  cancelled: 'tickets.err.cancelled',
  not_covered: 'tickets.err.not_covered',
  not_ticketed: 'tickets.code.notOpen',
  not_ready: 'tickets.join.notReady',
  other_device: 'tickets.join.otherDevice',
  failed: 'tickets.err.failed',
}

export function Message({ text, alert = false }: { text: string; alert?: boolean }) {
  return (
    <p className="text-sm" role={alert ? 'alert' : 'status'} style={{ color: alert ? 'var(--status-alert-fg)' : 'var(--text-primary)' }}>
      {text}
    </p>
  )
}

export const errorText = (code: TicketError, lang: 'en' | 'bg') => translate(ERROR_KEYS[code], lang)

/** Asks for the one-time code that moves a place to this device. */
export function OneTimeCodeForm({ lang, send, confirm, onMoved }: {
  lang: 'en' | 'bg'
  send: () => Promise<{ ok: boolean; code?: TicketError }>
  confirm: (code: string) => Promise<{ ok: boolean; code?: TicketError }>
  onMoved: () => void
}) {
  const t = (key: TranslationKey) => translate(key, lang)
  const [code, setCode] = useState('')
  const sending = useMutation({ mutationFn: send })
  const confirming = useMutation({
    mutationFn: () => confirm(code),
    onSuccess: (r) => {
      if (r.ok) onMoved()
    },
  })
  const sent = sending.data?.ok === true
  const failure: TicketError | null =
    sending.isError || confirming.isError ? 'failed'
    : !sent ? sending.data?.code ?? null
    : confirming.data?.code ?? null

  return (
    <div className="space-y-3">
      <button type="button" disabled={sending.isPending} onClick={() => sending.mutate()}
        className="text-sm font-semibold underline disabled:opacity-40" style={{ color: 'var(--text-primary)', minHeight: 44 }}>
        {t('tickets.join.sendCode')}
      </button>
      {sent && (
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault()
          if (!confirming.isPending) confirming.mutate()
        }}>
          <Message text={t('tickets.join.codeSent')} />
          <input aria-label={t('tickets.join.oneTimeCode')} placeholder={t('tickets.join.oneTimeCode')} required
            inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
            value={code} onChange={(e) => setCode(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
          <button type="submit" disabled={confirming.isPending} className={BUTTON_CLASS} style={BUTTON_STYLE}>
            {t('tickets.join.confirm')}
          </button>
        </form>
      )}
      {failure !== null && (
        <Message alert text={sent && failure === 'not_found' ? t('tickets.join.badOneTime') : errorText(failure, lang)} />
      )}
    </div>
  )
}

/** One online place. Joining is always a press, so opening an emailed link claims nothing. */
export function TicketJoinCard({ admissionId, name, lang, held }: {
  admissionId: string
  name?: string
  lang: 'en' | 'bg'
  held: boolean
}) {
  const t = (key: TranslationKey) => translate(key, lang)
  const join = useMutation({
    mutationFn: () => joinAdmission({ admissionId }),
    onSuccess: (r) => {
      if (r.ok) window.location.assign(r.url)
    },
  })
  const failure = join.isError ? 'failed' : join.data !== undefined && !join.data.ok ? join.data.code : null

  return (
    <div className="space-y-3">
      {name !== undefined && <p className="text-sm font-semibold break-words" style={{ color: 'var(--text-primary)' }}>{name}</p>}
      <button type="button" disabled={join.isPending} onClick={() => join.mutate()} className={BUTTON_CLASS} style={BUTTON_STYLE}>
        {join.isPending ? t('tickets.join.working') : t('tickets.join.button')}
      </button>
      {!held && failure === null && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('tickets.join.claims')}</p>}
      {failure !== null && (
        <Message alert text={failure === 'not_found' ? t('tickets.join.invalidLink') : errorText(failure, lang)} />
      )}
      {failure === 'other_device' && (
        <OneTimeCodeForm
          lang={lang}
          send={() => requestDeviceCode({ admissionId })}
          confirm={(code) => confirmDeviceCode({ admissionId, code })}
          onMoved={() => join.reset()}
        />
      )}
    </div>
  )
}
