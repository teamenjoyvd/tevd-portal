import type { createServiceClient } from '@/lib/supabase/service'
import { MAX_ZOOM_ATTEMPTS } from './redeem'
import type { ZoomPort } from './zoom-port'

/** Long enough to absorb a dropped connection: re-registering is limited by Zoom. */
export const LEFT_GRACE_MS = 10 * 60_000

/**
 * Ends the Zoom link of people who left and did not come back, so a link handed
 * on dies. The admission goes back to `pending_zoom`; pressing Join on the
 * claimed device registers it again. Never releases when no attempt remains.
 */
export async function releaseLeft({ supabase, zoom }: { supabase: ReturnType<typeof createServiceClient>; zoom: ZoomPort }) {
  const { data: rows, error } = await supabase
    .from('ticket_admissions')
    .select('id, event_id, zoom_ref, zoom_join_link, zoom_left_at, calendar_events!inner(end_time)')
    .eq('mode', 'online')
    .eq('status', 'active')
    // Healing leaves these rows alone once released.
    .not('attended_online_at', 'is', null)
    .lt('zoom_attempts', MAX_ZOOM_ATTEMPTS)
    .lt('zoom_left_at', new Date(Date.now() - LEFT_GRACE_MS).toISOString())
    .gt('calendar_events.end_time', new Date().toISOString())
  if (error) throw error

  let released = 0
  for (const row of rows) {
    if (row.zoom_ref === null || row.zoom_left_at === null) continue
    // Someone who came back meanwhile has zoom_left_at cleared by the webhook.
    const { data: taken, error: takeError } = await supabase
      .from('ticket_admissions')
      .update({ status: 'pending_zoom', zoom_ref: null, zoom_join_link: null, zoom_left_at: null })
      .eq('id', row.id)
      .eq('status', 'active')
      .eq('zoom_ref', row.zoom_ref)
      .eq('zoom_left_at', row.zoom_left_at)
      .select('id')
      .maybeSingle()
    if (takeError) throw takeError
    if (taken === null) continue
    try {
      await zoom.cancel({ eventId: row.event_id, ref: row.zoom_ref })
      released++
    } catch (err) {
      console.error('[tickets] release failed', row.id, err instanceof Error ? err.name : 'error')
      // Still registered in Zoom: put the link back and try again next minute.
      const { error: undoError } = await supabase
        .from('ticket_admissions')
        .update({ status: 'active', zoom_ref: row.zoom_ref, zoom_join_link: row.zoom_join_link, zoom_left_at: row.zoom_left_at })
        .eq('id', row.id)
        .eq('status', 'pending_zoom')
        .is('zoom_ref', null)
      if (undoError) console.error('[tickets] release undo failed', row.id)
    }
  }
  return { released }
}
