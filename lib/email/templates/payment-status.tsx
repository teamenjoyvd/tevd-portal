import { Button, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES as S } from "./layout";

type PaymentAdminStatus = "approved" | "denied";

interface PaymentStatusEmailProps {
  firstName: string;
  amount: string;
  itemName: string;
  status: PaymentAdminStatus;
  adminNote?: string;
}

export function PaymentStatusEmail({
  firstName,
  amount,
  itemName,
  status,
  adminNote,
}: PaymentStatusEmailProps) {
  const approved = status === "approved";
  const badgeColor = approved ? "#3E7785" : S.CRIMSON;
  const badgeLabel = approved ? "Потвърден" : "Отказан";
  const headline = approved
    ? "Плащането ви беше потвърдено"
    : "Плащането ви беше отказано";
  const body = approved
    ? `Здравей, ${firstName}. Плащането ви от ${amount} за „${itemName}“ беше потвърдено.`
    : `Здравей, ${firstName}. Плащането ви от ${amount} за „${itemName}“ не беше одобрено.`;
  const bodyEn = approved
    ? `Hi ${firstName}, your payment of ${amount} for "${itemName}" has been approved.`
    : `Hi ${firstName}, your payment of ${amount} for "${itemName}" was not approved.`;

  return (
    <EmailLayout preview={`${badgeLabel}: ${itemName} — ${amount}`}>
      <Text style={S.statusBadge(badgeColor)}>{badgeLabel}</Text>
      <Text style={S.h1}>{headline}</Text>
      <Text style={S.p}>{body}</Text>

      {adminNote ? (
        <Text style={S.pMuted}>Бележка от администратора: {adminNote}</Text>
      ) : null}

      <Hr style={S.divider} />

      <Text style={S.pMuted}>{bodyEn}</Text>

      {approved ? (
        <Section style={S.ctaSection}>
          <Button
            href="https://tevd-portal.vercel.app/profile"
            style={S.ctaButton}
          >
            Виж плащането → View Payment
          </Button>
        </Section>
      ) : null}
    </EmailLayout>
  );
}
