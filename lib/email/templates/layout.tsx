import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { ReactNode } from "react";

// ── Brand tokens (hardcoded — React Email renders outside the DOM) ──
const FOREST = "#2d332a";
const CRIMSON = "#bc4749";
const PARCHMENT = "#FAF8F3";
const VOID = "#1A1F18";
const STONE = "#8A8577";

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="bg" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={brandName}>teamenjoyVD</Text>
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              &copy; {new Date().getFullYear()} teamenjoyVD &nbsp;&middot;&nbsp;
              <a href="https://tevd-portal.vercel.app" style={footerLink}>
                tevd-portal.vercel.app
              </a>
            </Text>
            <Text style={footerDisclaimer}>
              Това е автоматично съобщение. Моля, не отговаряйте на него.
              <br />
              This is an automated message. Please do not reply.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ──

const body: React.CSSProperties = {
  backgroundColor: "#F0EDE6",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: 0,
  padding: "32px 0",
};

const container: React.CSSProperties = {
  backgroundColor: PARCHMENT,
  borderRadius: "12px",
  maxWidth: "560px",
  margin: "0 auto",
  overflow: "hidden",
  border: "1px solid rgba(45, 51, 42, 0.10)",
};

const header: React.CSSProperties = {
  backgroundColor: FOREST,
  padding: "24px 32px",
};

const brandName: React.CSSProperties = {
  color: PARCHMENT,
  fontSize: "18px",
  fontWeight: "700",
  letterSpacing: "0.02em",
  margin: 0,
};

const content: React.CSSProperties = {
  padding: "32px 32px 24px",
};

const footer: React.CSSProperties = {
  borderTop: "1px solid rgba(45, 51, 42, 0.08)",
  padding: "20px 32px 24px",
};

const footerText: React.CSSProperties = {
  color: STONE,
  fontSize: "12px",
  margin: "0 0 6px",
  textAlign: "center",
};

const footerLink: React.CSSProperties = {
  color: STONE,
  textDecoration: "underline",
};

const footerDisclaimer: React.CSSProperties = {
  color: STONE,
  fontSize: "11px",
  lineHeight: "1.5",
  margin: 0,
  textAlign: "center",
};

// ── Shared export tokens for use in individual templates ──
export const EMAIL_STYLES = {
  h1: {
    color: VOID,
    fontSize: "22px",
    fontWeight: "700",
    margin: "0 0 12px",
    lineHeight: "1.3",
  } satisfies React.CSSProperties,

  p: {
    color: VOID,
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 16px",
  } satisfies React.CSSProperties,

  pMuted: {
    color: STONE,
    fontSize: "14px",
    lineHeight: "1.6",
    margin: "0 0 16px",
  } satisfies React.CSSProperties,

  ctaButton: {
    display: "inline-block",
    backgroundColor: CRIMSON,
    color: PARCHMENT,
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "15px",
    fontWeight: "600",
    textDecoration: "none",
    textAlign: "center" as const,
  } satisfies React.CSSProperties,

  ctaSection: {
    textAlign: "center" as const,
    margin: "24px 0",
  } satisfies React.CSSProperties,

  divider: {
    borderColor: "rgba(45, 51, 42, 0.10)",
    margin: "20px 0",
  } satisfies React.CSSProperties,

  statusBadge: (bg: string): React.CSSProperties => ({
    display: "inline-block",
    backgroundColor: bg,
    color: PARCHMENT,
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    marginBottom: "16px",
  }),

  FOREST,
  CRIMSON,
  PARCHMENT,
  VOID,
  STONE,
} as const;
