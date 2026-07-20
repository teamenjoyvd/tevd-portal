import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding, labelStyle } from './_shell'

type Lang = 'en' | 'bg'

type Props = {
  name: string
  eventTitle: string
  magicLinkUrl: string
  lang?: Lang
}

const COPY: Record<Lang, {
  title: string
  preview: (eventTitle: string) => string
  hi: (name: string) => string
  registeredFor: string
  body: string
  button: string
  fallback: string
}> = {
  en: {
    title: 'Event Access Link',
    preview: eventTitle => `Your link to join ${eventTitle}`,
    hi: name => `Hi ${name},`,
    registeredFor: "You're registered for:",
    body: 'Use the button below to access the meeting details. This link is personal to you and expires shortly after the event ends.',
    button: 'Join Event',
    fallback: "If the button doesn't work, paste this link into your browser:",
  },
  bg: {
    title: 'Връзка за достъп до събитие',
    preview: eventTitle => `Вашата връзка за присъединяване към ${eventTitle}`,
    hi: name => `Здравейте, ${name},`,
    registeredFor: 'Регистрирани сте за:',
    body: 'Използвайте бутона по-долу, за да получите достъп до детайлите на срещата. Тази връзка е лична и изтича скоро след края на събитието.',
    button: 'Присъединяване',
    fallback: 'Ако бутонът не работи, копирайте тази връзка в браузъра си:',
  },
}

export function GuestEventMagicLinkEmail({ name, eventTitle, magicLinkUrl, lang = 'en' }: Props) {
  const c = COPY[lang]
  return (
    <EmailShell preview={c.preview(eventTitle)} title={c.title} lang={lang}>
      <Section style={bodyPadding}>
        <Text style={{ fontSize: 15, color: '#111827', margin: '0 0 16px' }}>
          {c.hi(name)}
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 8px' }}>
          {c.registeredFor}
        </Text>
        <Text style={{ ...labelStyle, fontSize: 13, margin: '0 0 24px' }}>
          {eventTitle}
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>
          {c.body}
        </Text>
        <Button
          href={magicLinkUrl}
          style={{
            backgroundColor: '#1a3c2e',
            color: '#ffffff',
            borderRadius: 8,
            padding: '12px 28px',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          {c.button}
        </Button>
        <Text style={{ fontSize: 12, color: '#9ca3af', margin: '20px 0 0' }}>
          {c.fallback}
        </Text>
        <Text style={{ fontSize: 12, color: '#6b7280', wordBreak: 'break-all', margin: '4px 0 0' }}>
          {magicLinkUrl}
        </Text>
      </Section>
    </EmailShell>
  )
}
