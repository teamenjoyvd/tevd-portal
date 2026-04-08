import { Button, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES as S } from "./layout";

interface DocumentExpiringSoonEmailProps {
  firstName: string;
  daysUntilExpiry: number;
  expiryDate: string;
}

export function DocumentExpiringSoonEmail({
  firstName,
  daysUntilExpiry,
  expiryDate,
}: DocumentExpiringSoonEmailProps) {
  const urgent = daysUntilExpiry <= 7;
  const badgeColor = urgent ? S.CRIMSON : "#8A8577";
  const badgeLabel = urgent ? "Спешно" : "Предупреждение";

  return (
    <EmailLayout
      preview={`Документът ви изтича след ${daysUntilExpiry} дни (${expiryDate})`}
    >
      <Text style={S.statusBadge(badgeColor)}>{badgeLabel}</Text>
      <Text style={S.h1}>Документът ви скоро изтича</Text>
      <Text style={S.p}>
        Здравей, {firstName}. Валидността на документа ви изтича след{" "}
        <strong>{daysUntilExpiry} дни</strong> — на {expiryDate}. Моля,
        актуализирайте документа си, за да не бъде спрян достъпъ
        ви до платформата.
      </Text>

      <Hr style={S.divider} />

      <Text style={S.pMuted}>
        Hi {firstName}, your document expires in{" "}
        <strong>{daysUntilExpiry} days</strong> on {expiryDate}. Please upload
        an updated document to maintain your platform access.
      </Text>

      <Section style={S.ctaSection}>
        <Button
          href={`${S.APP_URL}/profile`}
          style={S.ctaButton}
        >
          Актуализирай документ → Update Document
        </Button>
      </Section>
    </EmailLayout>
  );
}
