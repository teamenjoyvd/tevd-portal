import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin, getCallerContext } from '@/lib/supabase/guards'
import type { Database } from '@/types/supabase'

type CategoryFilter = 'N21' | 'Personal'

function parseCategory(value: string | null): CategoryFilter | null {
  return value === 'N21' || value === 'Personal' ? value : null
}

// Escape LIKE/ILIKE wildcards so a literal `%` or `_` in the search term
// doesn't get treated as a SQL wildcard.
function escapeLike(value: string): string {
  return value.replace(/([%_\\])/g, '\\$1')
}

export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const guard = await requireAdmin(userId, supabase)
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const category = parseCategory(searchParams.get('category'))
  const timeScope = searchParams.get('timeScope') ?? 'upcoming' // 'upcoming' | 'past' | 'all'

  let query = supabase
    .from('calendar_events')
    .select('*')
    .order('start_time', { ascending: true })

  if (search) query = query.ilike('title', `%${escapeLike(search)}%`)
  if (category) query = query.eq('category', category)

  const now = new Date().toISOString()
  if (timeScope === 'upcoming') query = query.gte('start_time', now)
  else if (timeScope === 'past') query = query.lt('start_time', now)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Attach active guest_registration_count per event — cheap for an admin
  // list (bounded page of events); drives the "N registered guests will be
  // notified" confirm-dialog copy in AdminCalendarClient.
  const eventIds = (data ?? []).map(ev => ev.id)
  const countByEventId = new Map<string, number>()
  if (eventIds.length > 0) {
    // Member registrations (2608-DEV-705) carry expires_at NULL; without the
    // is.null branch they never reach the count and the "N registered guests
    // will be notified" confirm copy silently under-reports.
    const nowIso = new Date().toISOString()
    const { data: regs, error: regsError } = await supabase
      .from('guest_registrations')
      .select('event_id')
      .in('event_id', eventIds)
      .is('cancelled_at', null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    if (regsError) console.error('Failed to fetch guest_registration_count, defaulting to 0:', regsError)
    for (const r of regs ?? []) {
      countByEventId.set(r.event_id, (countByEventId.get(r.event_id) ?? 0) + 1)
    }
  }
  const withCounts = (data ?? []).map(ev => ({
    ...ev,
    guest_registration_count: countByEventId.get(ev.id) ?? 0,
  }))

  return Response.json(withCounts)
}

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard
  const caller = ctx.profile

  const body = await req.json().catch(() => null)
  if (body === null || body === undefined || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Invalid or empty request body' }, { status: 400 })
  }

  const allowed = [
    'title', 'description', 'start_time', 'end_time', 'category',
    'event_type', 'meeting_url', 'access_roles', 'available_roles',
    'allow_guest_registration', 'guest_capacity', 'week_number',
  ] as const
  const picked: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) picked[key] = (body as Record<string, unknown>)[key]
  }

  if (typeof picked.title !== 'string' || typeof picked.start_time !== 'string' || typeof picked.end_time !== 'string') {
    return Response.json({ error: 'title, start_time, and end_time are required' }, { status: 400 })
  }

  const startDate = new Date(picked.start_time)
  const endDate = new Date(picked.end_time)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return Response.json({ error: 'start_time and end_time must be valid dates' }, { status: 400 })
  }

  // Auto-compute week_number only when the field is genuinely absent (not merely falsy — 0 is a valid value)
  if (picked.week_number === null || picked.week_number === undefined) {
    const startOfYear = new Date(startDate.getFullYear(), 0, 1)
    picked.week_number = Math.ceil(((startDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  }
  if (typeof picked.week_number !== 'number' || !Number.isInteger(picked.week_number)) {
    return Response.json({ error: 'week_number must be an integer' }, { status: 400 })
  }

  const insertData: Database['public']['Tables']['calendar_events']['Insert'] = {
    ...picked,
    title: picked.title,
    start_time: picked.start_time,
    end_time: picked.end_time,
    week_number: picked.week_number,
    created_by: caller.id,
  }

  const { data, error } = await supabase.from('calendar_events').insert(insertData).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Seed role slots for the new event
  const roles: string[] = data.available_roles ?? []
  if (roles.length > 0) {
    const { error: upsertError } = await supabase.from('event_role_slots').upsert(
      roles.map(role_label => ({ event_id: data.id, role_label })),
      { onConflict: 'event_id,role_label', ignoreDuplicates: true }
    )
    if (upsertError) return Response.json({ error: upsertError.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
