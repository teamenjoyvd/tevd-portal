import { Button, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES as S } from "./layout";

type RoleRequestResult = "approved" | "denied";

interface EventRoleRequestResultEmailProps {
  firstName: string;
  eventName: string;
  roleName: string;
  result: RoleRequestResult;
  adminNote?: string;
}

export function EventRoleRequestResultEmail({
  firstName,
  eventName,
  roleName,
  result,
  adminNote,
}: EventRoleRequestResultEmailProps) {
  const approved = result === "approved";
  const badgeColor = approved ? "#3E7785" : S.CRIMSON;
  const badgeLabel = approved ? "Одобрена" : "Отказана";
  const headline = approved
    ? `Ролята ви беше одобрена`
    : `Заявката ви за роля беше отказана`;
  const body = approved
    ? `Здравей, ${firstName}. Заявката ви за роля „${roleName}“ в събитието „${eventName}“ беше одобрена.`
    : `Здравей, ${firstName}. За съжаление, заявката ви за роля „${roleName}“ в „${eventName}“ не беше одобрена.`;
  const bodyEn = approved
    ? `Hi ${firstName}, your request for the role "${roleName}" at "${eventName}" has been approved.`
    : `Hi ${firstName}, your request for the role "${roleName}" at "${eventName}" was not approved.`;

  return (
    <EmailLayout preview={`${badgeLabel}: ${roleName} — ${eventName}`}>
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
            href="https://tevd-portal.vercel.app/calendar"
            style={S.ctaButton}
          >
            Виж събитието → View Event
          </Button>
        </Section>
      ) : null}
    </EmailLayout>
  );
}
