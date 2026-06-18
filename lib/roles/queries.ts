import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'
import { RoleEvent } from './types'

export async function getQuarterEvents(
  supabase: SupabaseClient<Database>,
  year: number,
  quarter: number
): Promise<RoleEvent[]> {
  const validatedQuarter = Math.max(1, Math.min(4, quarter))
  const validatedYear = year < 1970 || year > 2100 ? new Date().getUTCFullYear() : year
  const startMonth = (validatedQuarter - 1) * 3
  const startOfQuarter = new Date(Date.UTC(validatedYear, startMonth, 1, 0, 0, 0, 0)).toISOString()
  const startOfNextQuarter = new Date(Date.UTC(validatedYear, startMonth + 3, 1, 0, 0, 0, 0)).toISOString()

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

export async function getParticipationHistory(
  supabase: SupabaseClient<Database>
) {
  const { data, error } = await supabase
    .from('member_roles_history')
    .select('*')
    .order('total_count', { ascending: false })

  if (error) {
    console.error('Error fetching participation history:', error)
  }
  return data ?? []
}

export async function getEventYears(
  supabase: SupabaseClient<Database>
): Promise<number[]> {
  const { data, error } = await supabase.rpc('get_event_years')
  if (error) {
    console.error('Error fetching event years:', error)
  }
  return data?.map(row => row.year) ?? []
}
