import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export interface EventShareFilters {
  eventId?: string | null
  status?: string | null
  method?: string | null
  from?: string | null
  to?: string | null
  q?: string | null
}

export interface EventShareGuest {
  id: string
  name: string
  email: string
  status: string
  attended_at: string | null
  cancelled_at: string | null
  created_at: string
}

export interface EventShareLink {
  id: string
  token: string
  share_method: string
  click_count: number
  created_at: string
  revoked_at: string | null
  event: { id: string; title: string; start_time: string } | null
  guests: EventShareGuest[]
}

/**
 * Nested event_share_links query + in-memory guest filter (status/name-search
 * filter on the nested guest rows, not straightforward in PostgREST) shared by
 * app/api/profile/event-shares/route.ts (GET) and .../export/route.ts, which
 * previously duplicated this verbatim.
 */
export async function fetchEventShares(
  supabase: SupabaseClient,
  profileId: string,
  filters: EventShareFilters
): Promise<{ data: EventShareLink[] | null; error: PostgrestError | null }> {
  let query = supabase
    .from('event_share_links')
    .select(`
      id,
      token,
      share_method,
      click_count,
      created_at,
      revoked_at,
      event:calendar_events ( id, title, start_time ),
      guests:guest_registrations (
        id,
        name,
        email,
        status,
        attended_at,
        cancelled_at,
        created_at
      )
    `)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (filters.eventId) query = query.eq('event_id', filters.eventId)
  if (filters.method) query = query.eq('share_method', filters.method)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lte('created_at', filters.to)

  const { data: links, error } = await query
  if (error) return { data: null, error }

  // PostgREST resolves `event:calendar_events(...)` to a single object at
  // runtime (profile_id/event_id are both plain FKs, no ambiguity), but the
  // untyped query builder infers it as an array — cast through `unknown` to
  // the known runtime shape rather than fight the inferred type.
  const result = (links ?? []).map(link => ({
    ...link,
    guests: (link.guests as EventShareGuest[]).filter(g => {
      const guestStatus = g.attended_at !== null
        ? 'attended'
        : g.cancelled_at !== null
        ? 'cancelled'
        : g.status === 'confirmed'
        ? 'confirmed'
        : (link as unknown as { revoked_at: string | null }).revoked_at !== null
        ? 'cancelled'
        : 'pending'
      const matchStatus = filters.status ? guestStatus === filters.status : true
      const matchQ = filters.q ? g.name.toLowerCase().includes(filters.q.toLowerCase()) : true
      return matchStatus && matchQ
    }),
  })) as unknown as EventShareLink[]

  return { data: result, error: null }
}
