export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildReminderEmail(
  name: string,
  eventTitle: string,
  minutesBefore: number,
  eventStart: string,
  meetingUrl: string | null
): string {
  const label = minutesBefore >= 60 ? '1 hour' : '15 minutes';
  const formattedTime = new Date(eventStart).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Sofia',
  });

  const safeName = escapeHtml(name);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeFormattedTime = escapeHtml(formattedTime);
  const safeMeetingUrl = meetingUrl ? escapeHtml(meetingUrl) : null;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Event Reminder</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
        .header { background-color: #111827; padding: 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }
        .content { padding: 32px; }
        .text { margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 24px; }
        .badge { background-color: #bc474918; border: 1px solid #bc474944; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
        .badge-text { margin: 0; font-weight: 700; color: #bc4749; font-size: 15px; }
        .btn { display: inline-block; background-color: #bc4749; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; }
        .footer { padding: 20px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #f3f4f6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Event Reminder</h1>
        </div>
        <div class="content">
          <p class="text" style="color: #111827;">Hi ${safeName},</p>
          <p class="text">This is a reminder that your event is starting in <strong>${label}</strong>.</p>
          <div class="badge">
            <p class="badge-text">${safeEventTitle}</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">${safeFormattedTime}</p>
          </div>
          ${safeMeetingUrl ? `<p class="text" style="text-align:center;"><a href="${safeMeetingUrl}" class="btn">Join Event</a></p>` : ''}
          <p class="text" style="font-size: 14px; color: #6b7280;">See you there!</p>
        </div>
        <div class="footer">&copy; ${new Date().getFullYear()} TeamEnjoyVD</div>
      </div>
    </body>
    </html>
  `;
}

export function buildHtmlEmail(
  firstName: string,
  label: string,
  daysRemaining: number,
  validThrough: string
): string {
  const urgent = daysRemaining <= 30;
  const color = urgent ? '#bc4749' : '#7a5c00';

  const safeFirstName = escapeHtml(firstName);
  const safeLabel = escapeHtml(label);
  const safeValidThrough = escapeHtml(validThrough);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Document Expiry Warning</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
        .header { background-color: #111827; padding: 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }
        .content { padding: 32px; }
        .text { margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 24px; }
        .badge { background-color: ${color}18; border: 1px solid ${color}44; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
        .badge-text { margin: 0; font-weight: 700; color: ${color}; font-size: 15px; }
        .footer { padding: 20px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #f3f4f6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Action Required</h1>
        </div>
        <div class="content">
          <p class="text" style="color: #111827;">Hi ${safeFirstName},</p>
          <p class="text">This is a reminder that your <strong>${safeLabel}</strong> is expiring soon.</p>
          
          <div class="badge">
            <p class="badge-text">Expires: ${safeValidThrough} (${daysRemaining} days remaining)</p>
          </div>
          
          <p class="text">Please update your travel document in the portal before it expires to ensure uninterrupted access to trip registrations.</p>
          <p class="text" style="font-size: 14px; color: #6b7280; margin-bottom: 0;">Log into the portal &rarr; Profile &rarr; Travel Document to update your details.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} TeamEnjoyVD
        </div>
      </div>
    </body>
    </html>
  `;
}
