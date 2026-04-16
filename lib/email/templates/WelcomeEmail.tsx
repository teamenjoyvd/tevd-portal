/* eslint-disable i18next/no-literal-string -- TODO: email i18n — static server-rendered copy, no t() available */
import { Section, Text, Button } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding } from './_shell'

export type WelcomeEmailProps = {
  firstName: string
}

export function WelcomeEmail({ firstName }: WelcomeEmailProps) {
  return (
    <EmailShell
      preview="Welcome to Team Enjoy VD!"
      title="Welcome to the Portal 👋"
    >
      <Section style={{ ...bodyPadding }}>
        <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#111827' }}>
          Welcome, {firstName}!
        </Text>
        <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#374151' }}>
          Your account has been officially verified. You are now a full member of Team Enjoy VD.
        </Text>
        <Text style={{ margin: '0 0 16px', fontSize: 15, color: '#374151' }}>
          As a member, you now have access to:
        </Text>
        <ul style={{ margin: '0 0 20px', paddingLeft: 20, color: '#374151', fontSize: 15 }}>
          <li style={{ marginBottom: 8 }}><strong>Trips & Events</strong> – Register for upcoming trips and view the event calendar.</li>
          <li style={{ marginBottom: 8 }}><strong>Payments</strong> – Manage and log your payments securely.</li>
          <li style={{ marginBottom: 8 }}><strong>Resources</strong> – Access exclusive member resources and documents.</li>
        </ul>
        
        <Section style={{ textAlign: 'center', marginTop: 32, marginBottom: 32 }}>
          <Button
            href="https://tevd.app/profile"
            style={{
              backgroundColor: '#1E40AF',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: 6,
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Go to Your Profile
          </Button>
        </Section>
        
        <Text style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          We are thrilled to have you with us. If you have any questions, reach out to an administrator.
        </Text>
      </Section>
    </EmailShell>
  )
}
