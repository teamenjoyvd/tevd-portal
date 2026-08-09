// ── app/api/events/[id]/attend/route.ts ──────────────────────────────────
// POST   — member one-tap attend (body: { share?: string })
// DELETE — member self-service "can't attend"

import { z } from 'zod'
import { NextRequest } from 'next/server'
import { withProfile } from '@/lib/supabase/with-profile'
import { attendEvent, cancelMemberRegistration } from '@/lib/server/member-registration'

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

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role === 'guest') return Response.json({ error: 'Guests cannot use member attend' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })

  const profileName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()

  const result = await attendEvent(supabase, {
    eventId: id,
    profileId: profile.id,
    profileRole: profile.role,
    profileName,
    contactEmail: profile.contact_email,
    shareToken: parsed.data.share,
  })

  if (!result.success) return Response.json({ error: result.error }, { status: 400 })
  return Response.json({ registrationId: result.registrationId })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  const ctx = await withProfile<AttendProfile>('id, role, contact_email, first_name, last_name')
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role === 'guest') return Response.json({ error: 'Guests cannot use member attend' }, { status: 403 })

  const result = await cancelMemberRegistration(supabase, { eventId: id, profileId: profile.id })

  if (!result.success) return Response.json({ error: result.error }, { status: 400 })
  return Response.json({ success: true })
}
