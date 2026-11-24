'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  checkCode, confirmDeviceCodeByPosition, redeemCode, requestDeviceCodeByPosition, resendPasses, type CodeResult,
} from '@/lib/actions/tickets'
import { t as translate, type TranslationKey } from '@/lib/i18n'
import {
  BUTTON_CLASS, BUTTON_STYLE, INPUT_CLASS, INPUT_STYLE, Message, OneTimeCodeForm, TicketJoinCard, errorText,
} from '../../components/TicketJoinCard'

/** `heldIds`: places the page already shows; claiming one refreshes the page. */
type Props = { eventId: string; lang: 'en' | 'bg'; heldIds: string[] }
type Guest = { key: number; name: string; email: string }
type Pass = Extract<CodeResult, { ok: true }>

export function CodeJoinForm({ eventId, lang, heldIds }: Props) {
  const t = (key: TranslationKey) => translate(key, lang)
  const [code, setCode] = useState('')
  const check = useMutation({ mutationFn: () => checkCode({ eventId, code }) })

  if (check.data?.ok) return <PassStep eventId={eventId} lang={lang} heldIds={heldIds} code={code} pass={check.data} />

  const failure = check.isError ? 'failed' : check.data !== undefined && !check.data.ok ? check.data.code : null
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      if (!check.isPending) check.mutate()
    }}>
      <label htmlFor="ticket-code" className="text-sm block" style={{ color: 'var(--text-primary)' }}>{t('tickets.code.intro')}</label>
      <input id="ticket-code" aria-label={t('tickets.code.label')} required minLength={8} maxLength={10} autoComplete="off" autoCapitalize="characters"
        value={code} onChange={(e) => setCode(e.target.value)} className={`${INPUT_CLASS} font-mono uppercase tracking-widest`} style={INPUT_STYLE} />
      {failure !== null && <Message alert text={errorText(failure, lang)} />}
      <button type="submit" disabled={check.isPending} className={BUTTON_CLASS} style={BUTTON_STYLE}>
        {check.isPending ? t('tickets.join.working') : t('tickets.code.next')}
      </button>
    </form>
  )
}

function PassStep({ eventId, lang, heldIds, code, pass }: Props & { code: string; pass: Pass }) {
  const t = (key: TranslationKey) => translate(key, lang)
  const [includeHolder, setIncludeHolder] = useState(!pass.holderAdmitted && pass.entriesLeft > 0)
  const [guests, setGuests] = useState<Guest[]>([])
  const [nextKey, setNextKey] = useState(0)
  const [movingPosition, setMovingPosition] = useState<number | null>(null)
  const [movedId, setMovedId] = useState<string | null>(null)
  const redeem = useMutation({
    mutationFn: () => redeemCode({ eventId, code, includeHolder, guests: guests.map(({ name, email }) => ({ name, email })) }),
  })
  const used = guests.length + (includeHolder ? 1 : 0)

  if (redeem.data?.ok) {
    const { admissionId, emailed, ready } = redeem.data
    return (
      <div className="space-y-4">
        {admissionId !== null && !heldIds.includes(admissionId) && <TicketJoinCard admissionId={admissionId} name={pass.holderName} lang={lang} held />}
        {admissionId !== null && !ready && <Message text={t('tickets.join.notReady')} />}
        {emailed > 0 && <Message text={t('tickets.code.emailed').replace('{{n}}', String(emailed))} />}
      </div>
    )
  }
  if (movedId !== null) return heldIds.includes(movedId) ? null : <TicketJoinCard admissionId={movedId} lang={lang} held />

  const edit = (key: number, patch: Partial<Guest>) => setGuests((all) => all.map((g) => (g.key === key ? { ...g, ...patch } : g)))
  const failure = redeem.isError ? 'failed' : redeem.data !== undefined && !redeem.data.ok ? redeem.data.code : null

  return (
    <div className="space-y-5">
      <Message text={t('tickets.code.hello').replace('{{name}}', pass.holderName).replace('{{left}}', String(pass.entriesLeft))} />

      {pass.admitted.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('tickets.code.admitted')}</p>
          {pass.admitted.map(({ position, name }) => (
            <div key={position} className="border rounded-xl px-3 py-2" style={{ borderColor: 'var(--border-default)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm break-words min-w-0" style={{ color: 'var(--text-primary)' }}>{name}</span>
                <button type="button" onClick={() => setMovingPosition(position)} className="text-sm underline"
                  style={{ color: 'var(--text-primary)', minHeight: 44 }}>
                  {t('tickets.code.useOther')}
                </button>
              </div>
              {movingPosition === position && (
                <OneTimeCodeForm
                  lang={lang}
                  send={() => requestDeviceCodeByPosition({ eventId, code, position })}
                  confirm={async (oneTimeCode) => {
                    const r = await confirmDeviceCodeByPosition({ eventId, code, position, oneTimeCode })
                    if (r.ok) setMovedId(r.admissionId)
                    return r
                  }}
                  onMoved={() => setMovingPosition(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {pass.entriesLeft > 0 && (
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault()
          if (!redeem.isPending) redeem.mutate()
        }}>
          {!pass.holderAdmitted && (
            <label className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-primary)', minHeight: 44 }}>
              <input type="checkbox" checked={includeHolder} disabled={!includeHolder && used >= pass.entriesLeft}
                onChange={(e) => setIncludeHolder(e.target.checked)} />
              <span className="min-w-0 break-words">{t('tickets.code.me').replace('{{name}}', pass.holderName)}</span>
            </label>
          )}
          {guests.map((g) => (
            <fieldset key={g.key} className="space-y-2 border rounded-xl p-3" style={{ borderColor: 'var(--border-default)' }}>
              <input aria-label={t('tickets.code.guestName')} placeholder={t('tickets.code.guestName')} required minLength={2} maxLength={200}
                value={g.name} onChange={(e) => edit(g.key, { name: e.target.value })} className={INPUT_CLASS} style={INPUT_STYLE} />
              <input aria-label={t('tickets.code.guestEmail')} placeholder={t('tickets.code.guestEmail')} type="email" required maxLength={320}
                value={g.email} onChange={(e) => edit(g.key, { email: e.target.value })} className={INPUT_CLASS} style={INPUT_STYLE} />
              <button type="button" onClick={() => setGuests((all) => all.filter((x) => x.key !== g.key))}
                className="text-sm underline" style={{ color: 'var(--text-secondary)', minHeight: 44 }}>
                {t('tickets.code.removeGuest')}
              </button>
            </fieldset>
          ))}
          {used < pass.entriesLeft && guests.length < 20 && (
            <button type="button" className="text-sm font-semibold underline" style={{ color: 'var(--text-primary)', minHeight: 44 }}
              onClick={() => {
                setGuests((all) => [...all, { key: nextKey, name: '', email: '' }])
                setNextKey(nextKey + 1)
              }}>
              {t('tickets.code.addGuest')}
            </button>
          )}
          {guests.length > 0 && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('tickets.code.guestNote')}</p>}
          {failure !== null && <Message alert text={errorText(failure, lang)} />}
          <button type="submit" disabled={redeem.isPending || used === 0} className={BUTTON_CLASS} style={BUTTON_STYLE}>
            {redeem.isPending ? t('tickets.join.working') : t('tickets.code.submit').replace('{{n}}', String(used))}
          </button>
        </form>
      )}
    </div>
  )
}

/** The answer never depends on the address. */
export function LostCodeForm({ lang }: { lang: 'en' | 'bg' }) {
  const t = (key: TranslationKey) => translate(key, lang)
  const [email, setEmail] = useState('')
  const resend = useMutation({ mutationFn: () => resendPasses({ email }) })
  return (
    <form className="space-y-3 mt-6 pt-6" style={{ borderTop: '1px solid var(--border-default)' }} onSubmit={(e) => {
      e.preventDefault()
      if (!resend.isPending) resend.mutate()
    }}>
      <label htmlFor="lost-email" className="text-sm block" style={{ color: 'var(--text-primary)' }}>{t('tickets.lost.title')}</label>
      {resend.isSuccess ? (
        <Message text={t('tickets.lost.done')} />
      ) : (
        <>
          <input id="lost-email" type="email" required maxLength={320} autoComplete="email" placeholder={t('tickets.buy.email')}
            value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
          {resend.isError && <Message alert text={t('tickets.err.failed')} />}
          <button type="submit" disabled={resend.isPending} className="text-sm font-semibold underline disabled:opacity-40"
            style={{ color: 'var(--text-primary)', minHeight: 44 }}>
            {t('tickets.lost.send')}
          </button>
        </>
      )}
    </form>
  )
}
