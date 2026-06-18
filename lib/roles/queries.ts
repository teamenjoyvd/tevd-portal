import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'
import { RoleEvent } from './types'

export async function getQuarterEvents(
  supabase: SupabaseClient<Database>,
  year: number,
  quarter: number
): Promise<RoleEvent[]> {
  const startMonth = (quarter - 1) * 3
  const startOfQuarter = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0)).toISOString()
  const startOfNextQuarter = new Date(Date.UTC(year, startMonth + 3, 1, 0, 0, 0, 0)).toISOString()

  const { data, error } = await supabase
    .from('v_roles_history')
    .select('*')
    .gte('start_time', startOfQuarter)
    .lt('start_time', startOfNextQuarter)
    .order('start_time', { ascending: true })

  if (error || !data) return []

  return data.map(row => ({
    id: row.event_id ?? '',
    title: row.title ?? '',
    start_time: row.start_time ?? '',
    end_time: row.end_time ?? '',
    slots: {
      HOST: row.host_name || null,
      SPEAKER: row.speaker_name || null,
      PRODUCTS: row.products_name || null,
    },
  }))
}

export async function getHistoryEvents(
  supabase: SupabaseClient<Database>,
  page: number,
  limit: number,
  search: string
): Promise<{ events: RoleEvent[]; count: number }> {
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('v_roles_history')
    .select('*', { count: 'exact' })
    .order('start_time', { ascending: false })

  if (search.trim()) {
    const s = `%${search.trim()}%`
    query = query.or(`title.ilike.${s},host_name.ilike.${s},speaker_name.ilike.${s},products_name.ilike.${s}`)
  }

  const { data, count, error } = await query.range(from, to)

  if (error || !data) return { events: [], count: 0 }

  const events = data.map(row => ({
    id: row.event_id ?? '',
    title: row.title ?? '',
    start_time: row.start_time ?? '',
    end_time: row.end_time ?? '',
    slots: {
      HOST: row.host_name || null,
      SPEAKER: row.speaker_name || null,
      PRODUCTS: row.products_name || null,
    },
  }))

  return { events, count: count ?? 0 }
}

export async function getLeaderboard(
  supabase: SupabaseClient<Database>
) {
  const { data, error } = await supabase
    .from('member_roles_leaderboard')
    .select('*')
    .order('total_count', { ascending: false })

  return data ?? []
}
