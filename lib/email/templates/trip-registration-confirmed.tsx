import { Hr, Section, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES as S } from "./layout";

interface TripRegistrationConfirmedEmailProps {
  firstName: string;
  tripName: string;
  tripDate: string;
}

export function TripRegistrationConfirmedEmail({
  firstName,
  tripName,
  tripDate,
}: TripRegistrationConfirmedEmailProps) {
  return (
    <EmailLayout
      preview={`Регистрацията ви за ${tripName} беше получена.`}
    >
      <Text style={S.statusBadge(S.FOREST)}>Получена</Text>
      <Text style={S.h1}>Регистрацията ви беше получена</Text>
      <Text style={S.p}>
        Здравей, {firstName}. Получихме вашата регистрация за пътуването{" "}
        <strong>{tripName}</strong> на {tripDate}.
      </Text>
      <Text style={S.p}>
        Ще ви уведомим, когато администраторът прегледа и потвърди или
        откаже участието ви.
      </Text>

      <Hr style={S.divider} />

      <Text style={S.pMuted}>
        Hi {firstName}, your registration for <strong>{tripName}</strong> on{" "}
        {tripDate} has been received and is pending review.
      </Text>
    </EmailLayout>
  );
}
