/* eslint-disable i18next/no-literal-string -- TODO: email i18n — static server-rendered copy, no t() available */
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from '@react-email/components'
import * as React from 'react'

const brand = '#1a3c2e'
const accent = '#bc4749'
const muted  = '#6b7280'
const border = '#e5e7eb'

export const baseStyles = {
  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  backgroundColor: '#f9fafb',
  margin: 0,
  padding: 0,
}

export const containerStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: 12,
  overflow: 'hidden',
  border: `1px solid ${border}`,
}

export const headerStyle: React.CSSProperties = {
  backgroundColor: brand,
  padding: '28px 32px',
  textAlign: 'center' as const,
}

export const headingStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: 22,
  fontWeight: 700,
  margin: 0,
  letterSpacing: '-0.02em',
}

export const bodyPadding: React.CSSProperties = {
  padding: '28px 32px',
}

export const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: accent,
  margin: '0 0 6px',
}

export const footerStyle: React.CSSProperties = {
  padding: '16px 32px',
  borderTop: `1px solid ${border}`,
  textAlign: 'center' as const,
}

export const footerText: React.CSSProperties = {
  fontSize: 12,
  color: muted,
  margin: 0,
}

/** Minimal wrapper shared by all templates */
export function EmailShell({
  preview,
  title,
  children,
}: {
  preview: string
  title: string
  children: React.ReactNode
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={baseStyles}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Heading style={headingStyle}>TeamEnjoyVD</Heading>
          </Section>

          {/* Title row */}
          <Section style={{ ...bodyPadding, paddingBottom: 0 }}>
            <Text style={{ ...labelStyle }}>{title}</Text>
            <Hr style={{ borderColor: border, margin: '12px 0 0' }} />
          </Section>

          {/* Slot */}
          {children}

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerText}>
              © {new Date().getFullYear()} TeamEnjoyVD · This is an automated message.
            </Text>
            <Text style={{ ...footerText, marginTop: 4 }}>
              You can manage your email preferences from your Profile page.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
