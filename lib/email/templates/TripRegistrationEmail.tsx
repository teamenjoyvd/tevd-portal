import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding } from './_shell'

type Status = 'pending' | 'approved' | 'denied'

const STATUS_LABEL: Record<Status, string> = {
  pending:  'Pending approval',
  approved: 'Approved ✓',
  denied:   'Declined',
}
const STATUS_COLOR: Record<Status, string> = {
  pending:  '#7a5c00',
  approved: '#1a3c2e',
  denied:   '#bc4749',
}

export type TripRegistrationEmailProps = {
  firstName: string
  tripTitle: string
  destination: string
  startDate: string
  endDate: string
  status: Status
  adminNote?: string | null
}

export function TripRegistrationEmail({
  firstName,
  tripTitle,
  destination,
  startDate,
  endDate,
  status,
  adminNote,
}: TripRegistrationEmailProps) {
  const label = STATUS_LABEL[status]
  const color = STATUS_COLOR[status]

  return (
    <EmailShell
      preview={`Trip registration ${status} — ${tripTitle}`}
      title="Trip Registration Update"
    >
      <Section style={{ ...bodyPadding }}>
        <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#111827' }}>
          Hi {firstName},
        </Text>
        <Text style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>
          Your registration for <strong>{tripTitle}</strong> to {destination} ({startDate} – {endDate}) has been updated.
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

        {adminNote && (
          <Text style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280' }}>
            <strong>Note from admin:</strong> {adminNote}
          </Text>
        )}

        <Text style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Log into the portal to view full trip details and payment milestones.
        </Text>
      </Section>
    </EmailShell>
  )
}
