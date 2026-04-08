import { Hr, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES as S } from "./layout";

interface TripRegistrationCancelledEmailProps {
  firstName: string;
  tripName: string;
  tripDate: string;
  cancelledBy: "admin" | "member";
}

export function TripRegistrationCancelledEmail({
  firstName,
  tripName,
  tripDate,
  cancelledBy,
}: TripRegistrationCancelledEmailProps) {
  const byAdmin = cancelledBy === "admin";
  const body = byAdmin
    ? `Здравей, ${firstName}. Регистрацията ви за пътуването ${tripName} на ${tripDate} беше анулирана от администратор.`
    : `Здравей, ${firstName}. Успешно анулирахте регистрацията си за пътуването ${tripName} на ${tripDate}.`;
  const bodyEn = byAdmin
    ? `Hi ${firstName}, your registration for ${tripName} on ${tripDate} was cancelled by an administrator.`
    : `Hi ${firstName}, you have successfully cancelled your registration for ${tripName} on ${tripDate}.`;

  return (
    <EmailLayout preview={`Анулирана регистрация: ${tripName}`}>
      <Text style={S.statusBadge(S.STONE)}>Анулирана</Text>
      <Text style={S.h1}>Регистрацията беше анулирана</Text>
      <Text style={S.p}>{body}</Text>

      <Hr style={S.divider} />

      <Text style={S.pMuted}>{bodyEn}</Text>
    </EmailLayout>
  );
}
