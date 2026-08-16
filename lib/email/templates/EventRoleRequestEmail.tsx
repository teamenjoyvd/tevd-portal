/* eslint-disable i18next/no-literal-string -- TODO: email i18n — static server-rendered copy, no lang context available */
import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding } from './_shell'

type RoleStatus = 'approved' | 'denied' | 'cancelled'

const STATUS_LABEL: Record<RoleStatus, string> = {
  approved:  'Approved ✓',
  denied:    'Declined',
  cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<RoleStatus, string> = {
  approved:  '#1a3c2e',
  denied:    '#bc4749',
  // Neutral grey, not the alert red used for `denied`: a revoke is an
  // administrative change, not a rejection of the member (2608-DEV-749).
  cancelled: '#6b7280',
}

export type EventRoleRequestEmailProps = {
  firstName: string
  eventTitle: string
  eventDate: string
  roleLabel: string
  status: RoleStatus
}

export function EventRoleRequestEmail({
  firstName,
  eventTitle,
  eventDate,
  roleLabel,
  status,
}: EventRoleRequestEmailProps) {
  const label = STATUS_LABEL[status]
  const color = STATUS_COLOR[status]

  return (
    <EmailShell
      preview={`Role request ${status} — ${roleLabel} at ${eventTitle}`}
      title="Event Role Request Update"
    >
      <Section style={{ ...bodyPadding }}>
        <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#111827' }}>
          Hi {firstName},
        </Text>
        <Text style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>
          Your request for the role <strong>{roleLabel}</strong> at <strong>{eventTitle}</strong> ({eventDate}) has been reviewed.
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
            You have been assigned this role. Please check the event details in the portal calendar.
          </Text>
        )}

        {status === 'denied' && (
          <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#374151' }}>
            Your role request was not approved for this event. You can submit a new request from the calendar.
          </Text>
        )}

        {status === 'cancelled' && (
          <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#374151' }}>
            An administrator has cancelled your participation in this role, and the slot is open
            again for other members. Your registration for the event itself is unaffected — you are
            still expected to attend.
          </Text>
        )}

        <Text style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Log into the portal to view the event details.
        </Text>
      </Section>
    </EmailShell>
  )
}
