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
  justJoined: string
  body: (guestName: string) => React.ReactNode
  footer: string
}> = {
  en: {
    title: 'Guest Attended',
    preview: (guestName, eventTitle) => `${guestName} joined ${eventTitle}`,
    hi: name => `Hi ${name},`,
    justJoined: 'Your guest just joined:',
    body: guestName => (
      <>
        <strong>{guestName}</strong> clicked their access link and is now in the meeting.
      </>
    ),
    footer: 'You can view attendance details from your Profile page.',
  },
  bg: {
    title: 'Гостът се присъедини',
    preview: (guestName, eventTitle) => `${guestName} се присъедини към ${eventTitle}`,
    hi: name => `Здравейте, ${name},`,
    justJoined: 'Вашият гост току-що се присъедини към:',
    body: guestName => (
      <>
        <strong>{guestName}</strong> натисна връзката си за достъп и вече е в срещата.
      </>
    ),
    footer: 'Можете да видите подробности за присъствието в страницата Профил.',
  },
}

export function ShareGuestAttendedEmail({ sharerName, guestName, eventTitle, lang = 'en' }: Props) {
  const c = COPY[lang]
  return (
    <EmailShell preview={c.preview(guestName, eventTitle)} title={c.title} lang={lang}>
      <Section style={bodyPadding}>
        <Text style={{ fontSize: 15, color: '#111827', margin: '0 0 16px' }}>
          {c.hi(sharerName)}
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 8px' }}>
          {c.justJoined}
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
