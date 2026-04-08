import { ReactElement } from "react";
import { render } from "@react-email/render";
import { resend } from "./client";
import { createServiceClient } from "@/lib/supabase/service";

const FROM_ADDRESS = "teamenjoyVD <no-reply@tevd.bg>";

interface SendEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
  profileId?: string;
  templateName?: string;
}

export async function sendEmail({
  to,
  subject,
  template,
  profileId,
  templateName,
}: SendEmailOptions): Promise<void> {
  const html = await render(template);

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });

  const supabase = createServiceClient();

  await supabase.from("email_log").insert({
    recipient_email: to,
    subject,
    template_name: templateName ?? null,
    profile_id: profileId ?? null,
    resend_id: data?.id ?? null,
    status: error ? "failed" : "sent",
    error_message: error ? error.message : null,
  });

  if (error) {
    throw new Error(`Failed to send email to ${to}: ${error.message}`);
  }
}
