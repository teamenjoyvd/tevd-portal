import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding, labelStyle } from './_shell'

type Lang = 'en' | 'bg'

type Props = {
  guestName:  string
  eventTitle: string
  lang?: Lang
}

const COPY: Record<Lang, {
  title: string
  preview: (eventTitle: string) => string
  hi: (name: string) => string
  cancelledOf: string
  body: string
  footer: string
}> = {
  en: {
    title: 'Event Cancelled',
    preview: eventTitle => `${eventTitle} has been cancelled`,
    hi: name => `Hi ${name},`,
    cancelledOf: 'The following event has been cancelled:',
    body: 'You no longer need to attend — no further action is needed on your part.',
    footer: 'We apologize for any inconvenience this may cause.',
  },
  bg: {
    title: 'Събитието е отменено',
    preview: eventTitle => `${eventTitle} беше отменено`,
    hi: name => `Здравейте, ${name},`,
    cancelledOf: 'Следното събитие беше отменено:',
    body: 'Вече не е необходимо да присъствате — не се изисква никакво действие от ваша страна.',
    footer: 'Извиняваме се за евентуалните неудобства.',
  },
}

export function GuestEventCancelledEmail({ guestName, eventTitle, lang = 'en' }: Props) {
  const c = COPY[lang]
  return (
    <EmailShell preview={c.preview(eventTitle)} title={c.title} lang={lang}>
      <Section style={bodyPadding}>
        <Text style={{ fontSize: 15, color: '#111827', margin: '0 0 16px' }}>
          {c.hi(guestName)}
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 8px' }}>
          {c.cancelledOf}
        </Text>
        <Text style={{ ...labelStyle, fontSize: 13, margin: '0 0 16px' }}>
          {eventTitle}
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 24px' }}>
          {c.body}
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          {c.footer}
        </Text>
      </Section>
    </EmailShell>
  )
}
