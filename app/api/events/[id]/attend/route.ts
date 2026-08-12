// ── app/api/events/[id]/attend/route.ts ──────────────────────────────────
// POST   — member one-tap attend (body: { share?: string })
// DELETE — member self-service "can't attend"

import { z } from 'zod'
import { NextRequest } from 'next/server'
import { withProfile } from '@/lib/supabase/with-profile'
import { attendEvent, cancelMemberRegistration } from '@/lib/server/member-registration'
import { getLangFromCookies } from '@/lib/utils/lang-cookie'

type AttendProfile = {
  id: string
  role: string
  contact_email: string | null
  first_name: string | null
  last_name: string | null
}

const postSchema = z.object({ share: z.string().optional() })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  const ctx = await withProfile<AttendProfile>('id, role, contact_email, first_name, last_name')
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx

  // PGRST116 = PostgREST's "no row for .single()" — a genuinely absent
  // profile. Any other error is a real DB/lookup failure and must not be
  // reported to the caller as a 404.
  if (ctx.error && ctx.error.code !== 'PGRST116') {
    return Response.json({ error: 'Profile lookup failed' }, { status: 500 })
  }
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role === 'guest') return Response.json({ error: 'Guests cannot use member attend' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })

  const profileName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()

  // `profiles` has no lang column — the confirmation email follows the UI
  // language the caller is currently browsing in (2608-DEV-707).
  const lang = await getLangFromCookies()

  const result = await attendEvent(supabase, {
    eventId: id,
    profileId: profile.id,
    profileRole: profile.role,
    profileName,
    contactEmail: profile.contact_email,
    shareToken: parsed.data.share,
    lang,
  })

  // `code` is the contract the client selects its localized copy from
  // (2608-DEV-733); `error` stays the English developer/log string. Sending
  // both means a reworded sentence can no longer change what the member reads.
  if (result.success === false) return Response.json({ error: result.error, code: result.code }, { status: 400 })
  // `emailed` drives the client's success copy: it must not claim a
  // confirmation was sent when there was no contact_email to send it to.
  return Response.json({ registrationId: result.registrationId, emailed: result.emailed })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  const ctx = await withProfile<AttendProfile>('id, role, contact_email, first_name, last_name')
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx

  // PGRST116 = PostgREST's "no row for .single()" — a genuinely absent
  // profile. Any other error is a real DB/lookup failure and must not be
  // reported to the caller as a 404.
  if (ctx.error && ctx.error.code !== 'PGRST116') {
    return Response.json({ error: 'Profile lookup failed' }, { status: 500 })
  }
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role === 'guest') return Response.json({ error: 'Guests cannot use member attend' }, { status: 403 })

  const result = await cancelMemberRegistration(supabase, { eventId: id, profileId: profile.id })

  if (result.success === false) return Response.json({ error: result.error }, { status: 400 })
  return Response.json({ success: true })
}
