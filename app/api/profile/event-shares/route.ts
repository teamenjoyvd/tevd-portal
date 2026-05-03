// ── app/api/profile/event-shares/route.ts ────────────────────────────────
// POST  — upsert share link for the authenticated member
// GET   — return all share links with nested guest data, supports filtering

import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { NextRequest } from 'next/server'

// ── POST ─────────────────────────────────────────────────────────────────

const postSchema = z.object({
  event_id:     z.string().uuid(),
  share_method: z.enum(['native', 'clipboard']),
})

export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })

  const { event_id, share_method } = parsed.data
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()

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

  // Generate url-safe token (16 bytes = 22 base64url chars)
  const token = randomBytes(16).toString('base64url')

  const { data: link, error } = await supabase
    .from('event_share_links')
    .upsert(
      { profile_id: profile.id, event_id, token, share_method },
      { onConflict: 'profile_id,event_id', ignoreDuplicates: false },
    )
    .select('token')
    .single()

  if (error || !link) return Response.json({ error: 'Failed to create share link' }, { status: 500 })

  return Response.json({ token: link.token })
}

// ── GET ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = req.nextUrl
  const eventId  = searchParams.get('event_id')
  const status   = searchParams.get('status')   // 'pending' | 'confirmed' | 'attended'
  const method   = searchParams.get('method')   // 'native' | 'clipboard'
  const from     = searchParams.get('from')     // ISO date
  const to       = searchParams.get('to')       // ISO date
  const q        = searchParams.get('q')        // guest name search

  let query = supabase
    .from('event_share_links')
    .select(`
      id,
      token,
      share_method,
      click_count,
      created_at,
      event:calendar_events ( id, title, start_time ),
      guests:guest_registrations (
        id,
        name,
        email,
        status,
        attended_at,
        created_at
      )
    `)
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })

  if (eventId) query = query.eq('event_id', eventId)
  if (method)  query = query.eq('share_method', method)
  if (from)    query = query.gte('created_at', from)
  if (to)      query = query.lte('created_at', to)

  const { data: links, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Post-process: apply status and guest name filters in-memory
  // (these filter on nested guest rows — not straightforward in PostgREST)
  let result = links ?? []

  if (status || q) {
    result = result.map(link => ({
      ...link,
      guests: (link.guests as any[]).filter(g => {
        const guestStatus = g.attended_at ? 'attended' : g.status
        const matchStatus = status ? guestStatus === status : true
        const matchQ      = q ? (g.name as string).toLowerCase().includes(q.toLowerCase()) : true
        return matchStatus && matchQ
      }),
    }))
  }

  return Response.json({ links: result, total: result.length })
}
