import { Button, Section, Text, Link } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding, labelStyle } from './_shell'

type Lang = 'en' | 'bg'

type Props = {
  name: string
  eventTitle: string
  eventDateLabel: string
  meetingUrl: string | null
  /**
   * Token-free member join URL (D4). Recording attendance for a member is
   * authenticated through Clerk, so this URL carries no secret and is safe to
   * put in an inbox — unlike the guest magic link.
   */
  joinUrl: string
  googleCalUrl: string
  outlookUrl: string
  lang?: Lang
}

const COPY: Record<Lang, {
  title: string
  preview: (eventTitle: string) => string
  hi: (name: string) => string
  attending: string
  body: string
  button: string
  meetingFallback: string
  addToCalendar: string
  google: string
  outlook: string
  icsHint: string
}> = {
  en: {
    title: 'Attendance Confirmed',
    preview: eventTitle => `You're attending ${eventTitle}`,
    hi: name => `Hi ${name},`,
    attending: "You're attending:",
    body: 'Use the button below to open the meeting — it also records your attendance.',
    button: 'Join Event',
    meetingFallback: "If the button doesn't work, paste this link into your browser:",
    addToCalendar: 'Add to calendar',
    google: 'Google Calendar',
    outlook: 'Outlook',
    icsHint: 'Using Apple Calendar or another app? Download the .ics from the event page.',
  },
  bg: {
    title: 'Потвърдено присъствие',
    preview: eventTitle => `Ще присъствате на ${eventTitle}`,
    hi: name => `Здравейте, ${name},`,
    attending: 'Ще присъствате на:',
    body: 'Използвайте бутона по-долу, за да отворите срещата — така се отбелязва и вашето присъствие.',
    button: 'Присъединяване',
    meetingFallback: 'Ако бутонът не работи, копирайте тази връзка в браузъра си:',
    addToCalendar: 'Добави в календар',
    google: 'Google Calendar',
    outlook: 'Outlook',
    icsHint: 'Използвате Apple Calendar или друго приложение? Изтеглете .ics от страницата на събитието.',
  },
}

const calLinkStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#1a3c2e',
  fontWeight: 600,
  textDecoration: 'underline',
}

export function MemberEventConfirmationEmail({
  name,
  eventTitle,
  eventDateLabel,
  meetingUrl,
  joinUrl,
  googleCalUrl,
  outlookUrl,
  lang = 'en',
}: Props) {
  const c = COPY[lang]
  return (
    <EmailShell preview={c.preview(eventTitle)} title={c.title} lang={lang}>
      <Section style={bodyPadding}>
        <Text style={{ fontSize: 15, color: '#111827', margin: '0 0 16px' }}>
          {c.hi(name)}
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 8px' }}>
          {c.attending}
        </Text>
        <Text style={{ ...labelStyle, fontSize: 13, margin: '0 0 4px' }}>
          {eventTitle}
        </Text>
        <Text style={{ fontSize: 14, color: '#374151', margin: '0 0 24px' }}>
          {eventDateLabel}
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>
          {c.body}
        </Text>
        <Button
          href={joinUrl}
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

        {/* Copy-paste failsafe — the raw meeting URL, for a client that mangles
            the button or a member who wants to dial in from another device. */}
        {meetingUrl && (
          <>
            <Text style={{ fontSize: 12, color: '#9ca3af', margin: '20px 0 0' }}>
              {c.meetingFallback}
            </Text>
            <Text style={{ fontSize: 12, color: '#6b7280', wordBreak: 'break-all', margin: '4px 0 0' }}>
              {meetingUrl}
            </Text>
          </>
        )}

        {/* Add to calendar. The .ics is a client-only Blob download, so it is a
            link back to the join page rather than an attachment. */}
        <Text style={{ ...labelStyle, margin: '28px 0 8px' }}>
          {c.addToCalendar}
        </Text>
        <Text style={{ fontSize: 14, margin: '0 0 8px' }}>
          <Link href={googleCalUrl} style={calLinkStyle}>{c.google}</Link>
          {'   ·   '}
          <Link href={outlookUrl} style={calLinkStyle}>{c.outlook}</Link>
        </Text>
        <Text style={{ fontSize: 12, color: '#9ca3af', margin: '0' }}>
          {c.icsHint}
        </Text>
      </Section>
    </EmailShell>
  )
}
