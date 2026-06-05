/* eslint-disable i18next/no-literal-string -- TODO: email i18n — static server-rendered copy, no lang context available */
import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding } from './_shell'

export type SpouseLinkRequestEmailProps = {
  primaryFirstName: string
  requesterFirstName: string
  requesterLastName: string
  actionUrl: string
}

export function SpouseLinkRequestEmail({
  primaryFirstName,
  requesterFirstName,
  requesterLastName,
  actionUrl,
}: SpouseLinkRequestEmailProps) {
  return (
    <EmailShell
      preview={`${requesterFirstName} ${requesterLastName} has requested to link as your spouse account`}
      title="Spouse Link Request"
    >
      <Section style={{ ...bodyPadding }}>
        <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#111827' }}>
          Hi {primaryFirstName},
        </Text>
        <Text style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>
          <strong>{requesterFirstName} {requesterLastName}</strong> has submitted a request to be linked as your spouse account on the TeamEnjoyVD portal.
        </Text>
        <Text style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>
          You can review and approve or deny this request from your profile page.
        </Text>

        <Section
          style={{
            backgroundColor: '#1a3c2e18',
            border: '1px solid #1a3c2e44',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
          }}
        >
          <Text style={{ margin: 0, fontSize: 14, color: '#1a3c2e' }}>
            <a
              href={actionUrl}
              style={{ color: '#1a3c2e', fontWeight: 700, textDecoration: 'underline' }}
            >
              Review request →
            </a>
          </Text>
        </Section>

        <Text style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          If you don&apos;t recognise this person, you can safely deny the request. No action is required from you if you wish to deny it — but approving it will link their account to yours.
        </Text>
      </Section>
    </EmailShell>
  )
}
