import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

function buildHtmlEmail(firstName: string, label: string, daysRemaining: number, validThrough: string) {
  const urgent = daysRemaining <= 30
  const color = urgent ? '#bc4749' : '#7a5c00'
  
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
          <p class="text" style="color: #111827;">Hi ${firstName},</p>
          <p class="text">This is a reminder that your <strong>${label}</strong> is expiring soon.</p>
          
          <div class="badge">
            <p class="badge-text">Expires: ${validThrough} (${daysRemaining} days remaining)</p>
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
  `
}

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('SYNC_SECRET')
  if (secret && req.headers.get('x-sync-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY in edge environment' }), { status: 500 })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const now = new Date()
  
  // Find all profiles whose valid_through is 30 days or less away (and in the future)
  const todayStr = now.toISOString().split('T')[0]
  const targetDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const targetDateStr = targetDate.toISOString().split('T')[0]

  const { data: profiles, error: profileErr } = await sb
    .from('profiles')
    .select('id, first_name, document_active_type, valid_through, contact_email')
    .not('valid_through', 'is', null)
    .gte('valid_through', todayStr)
    .lte('valid_through', targetDateStr)

  if (profileErr) {
    return new Response(JSON.stringify({ error: 'Database error', detail: profileErr.message }), { status: 500 })
  }

  if (!profiles || profiles.length === 0) {
    return new Response(JSON.stringify({ message: 'No expiring documents found' }), { headers: { 'Content-Type': 'application/json' } })
  }

  let sentCount = 0
  const errors: string[] = []

  for (const profile of profiles) {
    // Check if a notification for this user, type 'document_expiring_soon' exists in the last 60 days
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const { data: existingNotifications } = await sb
      .from('notifications')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('type', 'doc_expiry')
      .gte('created_at', sixtyDaysAgo)
      .limit(1)

    if (existingNotifications && existingNotifications.length > 0) {
      continue // Already notified recently
    }

    // Skip if no email is set
    if (!profile.contact_email) {
      errors.push(`Missing email for profile ${profile.id}`)
      continue
    }

    // Calculate days remaining
    const expiryDate = new Date(profile.valid_through)
    const diffTime = Math.abs(expiryDate.getTime() - now.getTime())
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    const label = profile.document_active_type === 'passport' ? 'Passport' : 'National ID'
    
    // Insert notification
    await sb.from('notifications').insert({
      profile_id: profile.id,
      type: 'doc_expiry',
      title: 'Document Expiring Soon',
      message: `Your ${label} expires in ${daysRemaining} days. Please update it in your profile.`,
      action_url: '/profile'
    })

    // Send Email
    const htmlEmail = buildHtmlEmail(profile.first_name, label, daysRemaining, profile.valid_through)
    
    let resendStatus = 'pending'
    let resendId: string | null = null
    let errorMsg: string | null = null

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'TeamEnjoyVD <noreply@teamenjoyvd.com>',
          to: profile.contact_email,
          subject: `Action Required: Your ${label} expires in ${daysRemaining} days`,
          html: htmlEmail
        })
      })

      const resendData = await res.json()
      if (!res.ok) throw new Error(resendData.message || JSON.stringify(resendData))
      resendId = resendData.id
      resendStatus = 'sent'
      sentCount++
    } catch (err) {
      resendStatus = 'failed'
      errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`Email failed for ${profile.id}: ${errorMsg}`)
    }

    // Log to email_log
    await sb.from('email_log').insert({
      template: 'doc_expiry',
      recipient: profile.contact_email,
      payload: { profile_id: profile.id, days_remaining: daysRemaining, document_type: label },
      status: resendStatus,
      resend_id: resendId,
      error: errorMsg,
      sent_at: resendStatus === 'sent' ? new Date().toISOString() : null
    })
  }

  return new Response(JSON.stringify({ sent_count: sentCount, errors }), { headers: { 'Content-Type': 'application/json' } })
})
