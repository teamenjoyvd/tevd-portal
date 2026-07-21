import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding, labelStyle } from './_shell'

type Lang = 'en' | 'bg'

export type ChangedField = {
  field:    string
  oldValue: string
  newValue: string
}

type Props = {
  guestName:     string
  eventTitle:    string
  changedFields: ChangedField[]
  lang?: Lang
}

const FIELD_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    start_time:  'Start time',
    end_time:    'End time',
    location:    'Location',
    meeting_url: 'Meeting link',
  },
  bg: {
    start_time:  'Начален час',
    end_time:    'Краен час',
    location:    'Място',
    meeting_url: 'Връзка за срещата',
  },
}

const COPY: Record<Lang, {
  title: string
  preview: (eventTitle: string) => string
  hi: (name: string) => string
  intro: string
  footer: string
}> = {
  en: {
    title: 'Event Updated',
    preview: eventTitle => `Details changed for ${eventTitle}`,
    hi: name => `Hi ${name},`,
    intro: 'The following details changed for the event you registered for:',
    footer: 'If any of these changes affect your plans, please review before the event.',
  },
  bg: {
    title: 'Събитието е променено',
    preview: eventTitle => `Детайлите за ${eventTitle} бяха променени`,
    hi: name => `Здравейте, ${name},`,
    intro: 'Следните детайли за събитието, за което сте регистрирани, бяха променени:',
    footer: 'Ако някоя от тези промени засяга плановете ви, моля прегледайте ги преди събитието.',
  },
}

export function GuestEventUpdatedEmail({ guestName, eventTitle, changedFields, lang = 'en' }: Props) {
  const c = COPY[lang]
  const labels = FIELD_LABELS[lang]
  return (
    <EmailShell preview={c.preview(eventTitle)} title={c.title} lang={lang}>
      <Section style={bodyPadding}>
        <Text style={{ fontSize: 15, color: '#111827', margin: '0 0 16px' }}>
          {c.hi(guestName)}
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 8px' }}>
          {c.intro}
        </Text>
        <Text style={{ ...labelStyle, fontSize: 13, margin: '0 0 16px' }}>
          {eventTitle}
        </Text>
        {changedFields.map(cf => (
          <Text key={cf.field} style={{ fontSize: 14, color: '#374151', margin: '0 0 10px' }}>
            <strong>{labels[cf.field] ?? cf.field}:</strong>{' '}
            <span style={{ textDecoration: 'line-through', color: '#9ca3af' }}>{cf.oldValue}</span>
            {' → '}
            <span>{cf.newValue}</span>
          </Text>
        ))}
        <Text style={{ fontSize: 13, color: '#6b7280', margin: '16px 0 0' }}>
          {c.footer}
        </Text>
      </Section>
    </EmailShell>
  )
}
