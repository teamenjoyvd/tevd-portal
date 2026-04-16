/* eslint-disable i18next/no-literal-string -- TODO: email i18n — static server-rendered copy, no lang context available */
import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding } from './_shell'

type VerifStatus = 'approved' | 'denied'

const STATUS_LABEL: Record<VerifStatus, string> = {
  approved: 'Verified ✓',
  denied:   'Not approved',
}
const STATUS_COLOR: Record<VerifStatus, string> = {
  approved: '#1a3c2e',
  denied:   '#bc4749',
}

export type AboVerificationEmailProps = {
  firstName: string
  claimedAbo: string | null
  status: VerifStatus
  adminNote?: string | null
}

export function AboVerificationEmail({
  firstName,
  claimedAbo,
  status,
  adminNote,
}: AboVerificationEmailProps) {
  const label = STATUS_LABEL[status]
  const color = STATUS_COLOR[status]

  return (
    <EmailShell
      preview={`ABO verification ${status} — ${claimedAbo ?? 'your request'}`}
      title="ABO Verification Result"
    >
      <Section style={{ ...bodyPadding }}>
        <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#111827' }}>
          Hi {firstName},
        </Text>
        <Text style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>
          Your ABO verification request{claimedAbo ? ` for ABO #${claimedAbo}` : ''} has been reviewed by an administrator.
        </Text>

        {/* Status badge */}
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
            Status: {label}
          </Text>
        </Section>

        {status === 'approved' && (
          <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#374151' }}>
            You are now a verified Member and have full access to the portal.
          </Text>
        )}

        {status === 'denied' && (
          <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#374151' }}>
            Your details could not be verified. Please check your information and resubmit from your Profile page.
          </Text>
        )}

        {adminNote && (
          <Text style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280' }}>
            <strong>Admin note:</strong> {adminNote}
          </Text>
        )}

        <Text style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Log into the portal to view your profile and update your details.
        </Text>
      </Section>
    </EmailShell>
  )
}
