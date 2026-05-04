import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const { error } = await supabase
      .from('waiting_list')
      .insert({ email: email.toLowerCase().trim() })

    if (error) {
      if (error.code === '23505') {
        // Already signed up — treat as success, don't leak info
        return NextResponse.json({ ok: true })
      }
      console.error('[waiting-list] insert error:', error)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    // Fire-and-forget confirmation email
    resend.emails.send({
      from: 'teamenjoyVD <noreply@teamenjoyvd.com>',
      to: email,
      subject: "You're on the list",
      html: `
        <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #1A1F18;">
          <img src="https://www.teamenjoyvd.com/logo.png" alt="teamenjoyVD" style="height: 48px; margin-bottom: 32px;" />
          <h1 style="font-size: 24px; font-weight: normal; margin: 0 0 16px;">You're on the list.</h1>
          <p style="font-size: 16px; line-height: 1.6; color: #5C5950; margin: 0;">
            We'll let you know the moment teamenjoyVD launches. Stay close.
          </p>
        </div>
      `,
    }).catch(() => { /* swallow — not critical */ })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
