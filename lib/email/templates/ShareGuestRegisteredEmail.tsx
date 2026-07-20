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
  registeredFor: string
  body: (guestName: string) => React.ReactNode
  footer: string
}> = {
  en: {
    title: 'Guest Registered',
    preview: (guestName, eventTitle) => `${guestName} registered for ${eventTitle}`,
    hi: name => `Hi ${name},`,
    registeredFor: 'Your guest has registered for:',
    body: guestName => (
      <>
        <strong>{guestName}</strong> signed up through your share link and will receive
        a personal access link via email.
      </>
    ),
    footer: 'You can view the full history of your shared events from your Profile page.',
  },
  bg: {
    title: 'Регистриран гост',
    preview: (guestName, eventTitle) => `${guestName} се регистрира за ${eventTitle}`,
    hi: name => `Здравейте, ${name},`,
    registeredFor: 'Вашият гост се регистрира за:',
    body: guestName => (
      <>
        <strong>{guestName}</strong> се регистрира чрез вашата връзка за споделяне и ще получи
        лична връзка за достъп по имейл.
      </>
    ),
    footer: 'Можете да видите пълната история на споделените от вас събития в страницата Профил.',
  },
}

export function ShareGuestRegisteredEmail({ sharerName, guestName, eventTitle, lang = 'en' }: Props) {
  const c = COPY[lang]
  return (
    <EmailShell preview={c.preview(guestName, eventTitle)} title={c.title} lang={lang}>
      <Section style={bodyPadding}>
        <Text style={{ fontSize: 15, color: '#111827', margin: '0 0 16px' }}>
          {c.hi(sharerName)}
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 8px' }}>
          {c.registeredFor}
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
