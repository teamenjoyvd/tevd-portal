import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding, labelStyle } from './_shell'

type Lang = 'en' | 'bg'

type Props = {
  sharerName: string
  guestName:  string
  eventTitle: string
  lang?: Lang
}

const COPY: Record<Lang, {
  title: string
  preview: (guestName: string, eventTitle: string) => string
  hi: (name: string) => string
  cancelledFor: string
  body: (guestName: string) => React.ReactNode
  footer: string
}> = {
  en: {
    title: 'Guest Cancelled',
    preview: (guestName, eventTitle) => `${guestName} cancelled for ${eventTitle}`,
    hi: name => `Hi ${name},`,
    cancelledFor: 'Your guest can no longer attend:',
    body: guestName => (
      <>
        <strong>{guestName}</strong> cancelled their registration through your share link.
      </>
    ),
    footer: 'You can view the full history of your shared events from your Profile page.',
  },
  bg: {
    title: 'Гостът се отказа',
    preview: (guestName, eventTitle) => `${guestName} се отказа от ${eventTitle}`,
    hi: name => `Здравейте, ${name},`,
    cancelledFor: 'Вашият гост вече не може да присъства на:',
    body: guestName => (
      <>
        <strong>{guestName}</strong> отказа регистрацията си чрез вашата връзка за споделяне.
      </>
    ),
    footer: 'Можете да видите пълната история на споделените от вас събития в страницата Профил.',
  },
}

export function ShareGuestCancelledEmail({ sharerName, guestName, eventTitle, lang = 'en' }: Props) {
  const c = COPY[lang]
  return (
    <EmailShell preview={c.preview(guestName, eventTitle)} title={c.title} lang={lang}>
      <Section style={bodyPadding}>
        <Text style={{ fontSize: 15, color: '#111827', margin: '0 0 16px' }}>
          {c.hi(sharerName)}
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 8px' }}>
          {c.cancelledFor}
        </Text>
        <Text style={{ ...labelStyle, fontSize: 13, margin: '0 0 16px' }}>
          {eventTitle}
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 24px' }}>
          {c.body(guestName)}
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          {c.footer}
        </Text>
      </Section>
    </EmailShell>
  )
}
