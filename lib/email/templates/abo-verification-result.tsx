import { Button, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES as S } from "./layout";

type VerificationResult = "approved" | "denied";

interface AboVerificationResultEmailProps {
  firstName: string;
  result: VerificationResult;
  adminNote?: string;
}

export function AboVerificationResultEmail({
  firstName,
  result,
  adminNote,
}: AboVerificationResultEmailProps) {
  const approved = result === "approved";
  const badgeColor = approved ? "#3E7785" : S.CRIMSON;
  const badgeLabel = approved ? "Одобрен" : "Отказан";
  const headline = approved
    ? "Профилът ви беше потвърден"
    : "Профилът ви не беше потвърден";
  const body = approved
    ? `Здравей, ${firstName}. Верификацията ви в teamenjoyVD беше одобрена. Вече имате пълен достъп до платформата.`
    : `Здравей, ${firstName}. За съжаление, верификацията ви не беше одобрена.`;
  const bodyEn = approved
    ? `Hi ${firstName}, your membership verification has been approved. You now have full access to the platform.`
    : `Hi ${firstName}, unfortunately your membership verification was not approved.`;

  return (
    <EmailLayout preview={`${badgeLabel}: верификация teamenjoyVD`}>
      <Text style={S.statusBadge(badgeColor)}>{badgeLabel}</Text>
      <Text style={S.h1}>{headline}</Text>
      <Text style={S.p}>{body}</Text>

      {adminNote ? (
        <Text style={S.pMuted}>Бележка: {adminNote}</Text>
      ) : null}

      <Hr style={S.divider} />

      <Text style={S.pMuted}>{bodyEn}</Text>

      {approved ? (
        <Section style={S.ctaSection}>
          <Button
            href="https://tevd-portal.vercel.app"
            style={S.ctaButton}
          >
            Отиди към таблото → Go to Dashboard
          </Button>
        </Section>
      ) : null}
    </EmailLayout>
  );
}
