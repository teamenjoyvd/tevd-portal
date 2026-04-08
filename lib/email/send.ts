import { ReactElement } from "react";
import { render } from "@react-email/render";
import { resend } from "./client";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/supabase";

const FROM_ADDRESS = "teamenjoyVD <no-reply@tevd.bg>";

interface SendEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
  profileId?: string;
  templateName?: string;
}

// sendEmail logs the result to email_log and swallows errors.
// Email failure is non-critical-path — check email_log for delivery status.
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
    recipient: to,
    template: templateName ?? "unknown",
    payload: { subject, profile_id: profileId ?? null } as unknown as Json,
    resend_id: data?.id ?? null,
    status: error ? "failed" : "sent",
    sent_at: error ? null : new Date().toISOString(),
    error: error ? error.message : null,
  });
}
