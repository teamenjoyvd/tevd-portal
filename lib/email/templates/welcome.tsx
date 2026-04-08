import { Button, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES as S } from "./layout";

interface WelcomeEmailProps {
  firstName: string;
}

export function WelcomeEmail({ firstName }: WelcomeEmailProps) {
  return (
    <EmailLayout preview={`Добре дошли в teamenjoyVD, ${firstName}!`}>
      <Text style={S.h1}>Добре дошли, {firstName}! 👋</Text>
      <Text style={S.p}>
        Вашият профил в teamenjoyVD беше потвърден. Вече имате достъп до
        всички функции на платформата.
      </Text>
      <Text style={S.p}>
        Можете да разглеждате предстоящи пътувания, да управлявате
        документите си и да следите известията си от таблото.
      </Text>

      <Hr style={S.divider} />

      <Text style={S.pMuted}>
        Welcome to teamenjoyVD, {firstName}! Your profile has been verified
        and you now have full access to the platform.
      </Text>

      <Section style={S.ctaSection}>
        <Button href={S.APP_URL} style={S.ctaButton}>
          Отиди към таблото → Go to Dashboard
        </Button>
      </Section>
    </EmailLayout>
  );
}
