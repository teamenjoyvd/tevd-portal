import { Button, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES as S } from "./layout";

type RegistrationStatus = "approved" | "denied";

interface TripRegistrationStatusEmailProps {
  firstName: string;
  tripName: string;
  tripDate: string;
  status: RegistrationStatus;
  adminNote?: string;
}

export function TripRegistrationStatusEmail({
  firstName,
  tripName,
  tripDate,
  status,
  adminNote,
}: TripRegistrationStatusEmailProps) {
  const approved = status === "approved";
  const badgeColor = approved ? "#3E7785" : S.CRIMSON;
  const badgeLabel = approved ? "Одобрена" : "Отказана";
  const headline = approved
    ? "Регистрацията ви беше одобрена!"
    : "Регистрацията ви беше отказана";
  const body = approved
    ? `Здравей, ${firstName}. Участието ви в пътуването ${tripName} на ${tripDate} беше одобрено. Очакваме ви!`
    : `Здравей, ${firstName}. За съжаление, участието ви в пътуването ${tripName} на ${tripDate} не беше одобрено.`;
  const bodyEn = approved
    ? `Hi ${firstName}, your participation in ${tripName} on ${tripDate} has been approved.`
    : `Hi ${firstName}, your registration for ${tripName} on ${tripDate} was not approved.`;

  return (
    <EmailLayout preview={`${badgeLabel}: ${tripName}`}>
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
            href={`${S.APP_URL}/trips`}
            style={S.ctaButton}
          >
            Виж пътуването → View Trip
          </Button>
        </Section>
      ) : null}
    </EmailLayout>
  );
}
