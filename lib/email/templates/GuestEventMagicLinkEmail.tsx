/* eslint-disable i18next/no-literal-string -- TODO: email i18n — static server-rendered copy, no t() available */
import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding, labelStyle } from './_shell'

type Props = {
  name: string
  eventTitle: string
  magicLinkUrl: string
}

export function GuestEventMagicLinkEmail({ name, eventTitle, magicLinkUrl }: Props) {
  return (
    <EmailShell preview={`Your link to join ${eventTitle}`} title="Event Access Link">
      <Section style={bodyPadding}>
        <Text style={{ fontSize: 15, color: '#111827', margin: '0 0 16px' }}>
          Hi {name},
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 8px' }}>
          You&apos;re registered for:
        </Text>
        <Text style={{ ...labelStyle, fontSize: 13, margin: '0 0 24px' }}>
          {eventTitle}
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>
          Use the button below to access the meeting details. This link is personal
          to you and expires in 72 hours.
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
          Join Event
        </Button>
        <Text style={{ fontSize: 12, color: '#9ca3af', margin: '20px 0 0' }}>
          If the button doesn&apos;t work, paste this link into your browser:
        </Text>
        <Text style={{ fontSize: 12, color: '#6b7280', wordBreak: 'break-all', margin: '4px 0 0' }}>
          {magicLinkUrl}
        </Text>
      </Section>
    </EmailShell>
  )
}
