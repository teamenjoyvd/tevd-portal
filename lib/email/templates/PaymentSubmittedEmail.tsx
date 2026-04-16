/* eslint-disable i18next/no-literal-string -- TODO: email i18n — static server-rendered copy, no t() available */
import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding } from './_shell'

export type PaymentSubmittedEmailProps = {
  memberName: string
  amount: number
  currency: string
  transactionDate: string
  itemTitle: string
  paymentMethod: string | null
}

export function PaymentSubmittedEmail({
  memberName,
  amount,
  currency,
  transactionDate,
  itemTitle,
  paymentMethod,
}: PaymentSubmittedEmailProps) {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  return (
    <EmailShell
      preview={`New payment logged by ${memberName}`}
      title="New Payment Logged"
    >
      <Section style={{ ...bodyPadding }}>
        <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#111827' }}>
          Hello Admin,
        </Text>
        <Text style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>
          <strong>{memberName}</strong> has logged a new payment of <strong>{formatted}</strong> for <strong>{itemTitle}</strong>.
        </Text>
        <Section
          style={{
            backgroundColor: `#f3f4f6`,
            border: `1px solid #e5e7eb`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
          }}
        >
          <Text style={{ margin: '0 0 8px', fontSize: 14 }}>
            <strong>Date:</strong> {transactionDate}
          </Text>
          <Text style={{ margin: '0 0 8px', fontSize: 14 }}>
            <strong>Method:</strong> {paymentMethod || 'Not specified'}
          </Text>
        </Section>
        <Text style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Please review this payment in the admin portal to approve or reject it.
        </Text>
      </Section>
    </EmailShell>
  )
}
