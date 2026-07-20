// ── app/api/profile/event-shares/route.ts ────────────────────────────────
// POST  — upsert share link for the authenticated member
// GET   — return all share links with nested guest data, supports filtering

import { requireAuth, withProfile } from '@/lib/supabase/with-profile'
import { fetchEventShares } from '@/lib/server/event-shares'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { NextRequest } from 'next/server'

// ── POST ─────────────────────────────────────────────────────────────────

const postSchema = z.object({
  event_id:     z.string().uuid(),
  share_method: z.enum(['native', 'clipboard', 'qr']),
})

export async function POST(req: NextRequest): Promise<Response> {
  const authCtx = await requireAuth()
  if (authCtx.response) return authCtx.response

  const body = await req.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })

  const { event_id, share_method } = parsed.data

  const ctx = await withProfile()
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role === 'guest') return Response.json({ error: 'Guests cannot share events' }, { status: 403 })

  // Verify event exists and has guest registration enabled
  const { data: event } = await supabase
    .from('calendar_events')
    .select('id, allow_guest_registration')
    .eq('id', event_id)
    .single()

  if (!event?.allow_guest_registration) {
    return Response.json({ error: 'Event does not allow guest registration' }, { status: 400 })
  }

  // Check if a link already exists for this member+event pair.
  // If it does, return the existing token — never regenerate it, as the member
  // may have already distributed the previous link.
  const { data: existing } = await supabase
    .from('event_share_links')
    .select('token, revoked_at')
    .eq('profile_id', profile.id)
    .eq('event_id', event_id)
    .single()

  if (existing && !existing.revoked_at) {
    // Update share_method (last-write-wins) without touching the token.
    await supabase
      .from('event_share_links')
      .update({ share_method })
      .eq('profile_id', profile.id)
      .eq('event_id', event_id)

    return Response.json({ token: existing.token })
  }

  // No existing link, or the prior one was revoked — mint a fresh url-safe
  // token (16 bytes = 22 base64url chars). A revoked link's row is unique on
  // (profile_id, event_id), so upsert rather than insert.
  const token = randomBytes(16).toString('base64url')

  const { data: link, error } = await supabase
    .from('event_share_links')
    .upsert(
      { profile_id: profile.id, event_id, token, share_method, revoked_at: null },
      { onConflict: 'profile_id,event_id' },
    )
    .select('token')
    .single()

  if (error || !link) return Response.json({ error: 'Failed to create share link' }, { status: 500 })

  return Response.json({ token: link.token })
}

// ── GET ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  const ctx = await withProfile()
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = req.nextUrl
  const eventId  = searchParams.get('event_id')
  const status   = searchParams.get('status')   // 'pending' | 'confirmed' | 'attended'
  const method   = searchParams.get('method')   // 'native' | 'clipboard'
  const from     = searchParams.get('from')     // ISO date
  const to       = searchParams.get('to')       // ISO date
  const q        = searchParams.get('q')        // guest name search

  const { data: result, error } = await fetchEventShares(supabase, profile.id, {
    eventId, status, method, from, to, q,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ links: result, total: (result ?? []).length })
}
