/* eslint-disable i18next/no-literal-string -- TODO: email i18n — static server-rendered copy, no t() available */
import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding } from './_shell'

type PaymentStatus = 'pending' | 'approved' | 'denied'

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending:  'Pending review',
  approved: 'Approved ✓',
  denied:   'Declined',
}
const STATUS_COLOR: Record<PaymentStatus, string> = {
  pending:  '#7a5c00',
  approved: '#1a3c2e',
  denied:   '#bc4749',
}

export type PaymentStatusEmailProps = {
  firstName: string
  amount: number
  currency: string
  transactionDate: string
  adminStatus: PaymentStatus
  itemTitle: string
  adminNote?: string | null
  rejectReason?: string | null
}

export function PaymentStatusEmail({
  firstName,
  amount,
  currency,
  transactionDate,
  adminStatus,
  itemTitle,
  adminNote,
  rejectReason,
}: PaymentStatusEmailProps) {
  const label = STATUS_LABEL[adminStatus]
  const color = STATUS_COLOR[adminStatus]
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  return (
    <EmailShell
      preview={`Payment ${adminStatus} — ${formatted} for ${itemTitle}`}
      title="Payment Update"
    >
      <Section style={{ ...bodyPadding }}>
        <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#111827' }}>
          Hi {firstName},
        </Text>
        <Text style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>
          Your payment of <strong>{formatted}</strong> for <strong>{itemTitle}</strong> submitted on {transactionDate} has been reviewed.
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
          <Text style={{ margin: '0 0 12px', fontSize: 14, color: '#6b7280' }}>
            <strong>Admin note:</strong> {adminNote}
          </Text>
        )}
        {rejectReason && (
          <Text style={{ margin: '0 0 12px', fontSize: 14, color: '#bc4749' }}>
            <strong>Reason:</strong> {rejectReason}
          </Text>
        )}

        <Text style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Log into the portal to view your full payment history.
        </Text>
      </Section>
    </EmailShell>
  )
}
