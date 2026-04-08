import { Hr, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES as S } from "./layout";

interface PaymentSubmittedEmailProps {
  amount: string;
  itemName: string;
  submittedBy: string;
  profileUrl?: string;
}

export function PaymentSubmittedEmail({
  amount,
  itemName,
  submittedBy,
  profileUrl,
}: PaymentSubmittedEmailProps) {
  return (
    <EmailLayout
      preview={`Ново плащане от ${submittedBy}: ${amount} за ${itemName}`}
    >
      <Text style={S.statusBadge(S.FOREST)}>Ново плащане</Text>
      <Text style={S.h1}>Постъпи ново плащане</Text>
      <Text style={S.p}>
        {submittedBy} декларира плащане от{" "}
        <strong>{amount}</strong> за „{itemName}“. Прегледайте и потвърдете или
        откажете плащането в админпанела.
      </Text>

      <Hr style={S.divider} />

      <Text style={S.pMuted}>
        {submittedBy} has submitted a payment of {amount} for &ldquo;{itemName}
        &rdquo;. Please review it in the admin panel.
      </Text>

      {profileUrl ? (
        <Text style={{ ...S.pMuted, marginTop: 0 }}>
          <a href={profileUrl} style={{ color: S.CRIMSON }}>
            Виж профила → View Profile
          </a>
        </Text>
      ) : null}
    </EmailLayout>
  );
}
