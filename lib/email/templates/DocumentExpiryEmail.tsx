/* eslint-disable i18next/no-literal-string -- TODO: email i18n — static server-rendered copy, no lang context available */
import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding } from './_shell'

export type DocumentExpiryEmailProps = {
  firstName: string
  documentType: 'id' | 'passport'
  validThrough: string
  daysRemaining: number
}

const DOC_LABEL: Record<'id' | 'passport', string> = {
  id:       'National ID',
  passport: 'Passport',
}

export function DocumentExpiryEmail({
  firstName,
  documentType,
  validThrough,
  daysRemaining,
}: DocumentExpiryEmailProps) {
  const urgent = daysRemaining <= 30
  const color  = urgent ? '#bc4749' : '#7a5c00'
  const label  = DOC_LABEL[documentType]

  return (
    <EmailShell
      preview={`Action required: Your ${label} expires in ${daysRemaining} days`}
      title="Document Expiry Warning"
    >
      <Section style={{ ...bodyPadding }}>
        <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#111827' }}>
          Hi {firstName},
        </Text>
        <Text style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>
          This is a reminder that your <strong>{label}</strong> is expiring soon.
        </Text>

        {/* Warning badge */}
        <Section
          style={{
            backgroundColor: `${color}18`,
            border: `1px solid ${color}44`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
          }}
        >
          <Text style={{ margin: 0, fontWeight: 700, color, fontSize: 15 }}>
            Expires: {validThrough} ({daysRemaining} days remaining)
          </Text>
        </Section>

        <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#374151' }}>
          Please update your travel document in the portal before it expires to ensure
          uninterrupted access to trip registrations.
        </Text>

        <Text style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Log into the portal → Profile → Travel Document to update your details.
        </Text>
      </Section>
    </EmailShell>
  )
}
