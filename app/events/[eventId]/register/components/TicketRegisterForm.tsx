'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { registerFree } from '@/lib/actions/tickets'
import { t as translate, type TranslationKey } from '@/lib/i18n'
import {
  BUTTON_CLASS, BUTTON_STYLE, INPUT_CLASS, INPUT_STYLE, Message, TicketJoinCard, errorText,
} from '../../components/TicketJoinCard'

type Props = { eventId: string; lang: 'en' | 'bg'; member: { name: string; email: string } | null; heldIds: string[] }

export function TicketRegisterForm({ eventId, lang, member, heldIds }: Props) {
  const t = (key: TranslationKey) => translate(key, lang)
  const [name, setName] = useState(member?.name ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const register = useMutation({ mutationFn: () => registerFree({ eventId, name, email }) })

  if (register.data?.ok) {
    const { admissionId, ready } = register.data
    if (admissionId === null) return <Message text={t('tickets.register.check')} />
    return (
      <div className="space-y-4">
        <Message text={t('tickets.register.done')} />
        {!heldIds.includes(admissionId) && <TicketJoinCard admissionId={admissionId} lang={lang} held />}
        <Message text={t(ready ? 'tickets.register.sentTo' : 'tickets.join.notReady')} />
      </div>
    )
  }

  const failure = register.isError ? 'failed' : register.data !== undefined && !register.data.ok ? register.data.code : null
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      if (!register.isPending) register.mutate()
    }}>
      <Message text={t('tickets.register.intro')} />
      <div>
        <label htmlFor="ticket-name" className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('tickets.buy.name')}</label>
        <input id="ticket-name" required minLength={2} maxLength={200} autoComplete="name" value={name}
          readOnly={member !== null && member.name !== ''} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
      </div>
      <div>
        <label htmlFor="ticket-email" className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('tickets.buy.email')}</label>
        <input id="ticket-email" type="email" required maxLength={320} autoComplete="email" value={email}
          readOnly={member !== null} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
      </div>
      {failure !== null && <Message alert text={errorText(failure, lang)} />}
      <button type="submit" disabled={register.isPending} className={BUTTON_CLASS} style={BUTTON_STYLE}>
        {register.isPending ? t('tickets.join.working') : t('tickets.register.submit')}
      </button>
    </form>
  )
}
