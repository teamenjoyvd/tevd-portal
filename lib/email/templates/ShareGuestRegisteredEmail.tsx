/* eslint-disable i18next/no-literal-string -- email i18n not available in server-render context */
import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding, labelStyle } from './_shell'

type Props = {
  sharerName: string
  guestName:  string
  eventTitle: string
}

export function ShareGuestRegisteredEmail({ sharerName, guestName, eventTitle }: Props) {
  return (
    <EmailShell preview={`${guestName} registered for ${eventTitle}`} title="Guest Registered">
      <Section style={bodyPadding}>
        <Text style={{ fontSize: 15, color: '#111827', margin: '0 0 16px' }}>
          Hi {sharerName},
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 8px' }}>
          Your guest has registered for:
        </Text>
        <Text style={{ ...labelStyle, fontSize: 13, margin: '0 0 16px' }}>
          {eventTitle}
        </Text>
        <Text style={{ fontSize: 15, color: '#374151', margin: '0 0 24px' }}>
          <strong>{guestName}</strong> signed up through your share link and will receive
          a personal access link via email.
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          You can view the full history of your shared events from your Profile page.
        </Text>
      </Section>
    </EmailShell>
  )
}
