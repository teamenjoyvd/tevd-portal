// Deno copy of isTicketedEvent in lib/server/meeting-url-visibility.ts: change both.

type EventIdentity = { id: string; source: string; series_key: string | null }
type Result = PromiseLike<{ data: unknown[] | null; error: unknown }>
type Client = {
  from(table: string): { select(columns: string): { eq(column: string, value: string): { limit(n: number): Result } } }
}

/** Fails closed: if the lookup fails the event counts as ticketed. */
export async function isTicketedEvent(supabase: Client, event: EventIdentity): Promise<boolean> {
  if (event.source === 'zoom') return true
  if (event.source !== 'portal') return false
  const product = (column: string, value: string) =>
    supabase.from('ticket_products').select('id').eq(column, value).limit(1)
  const results = await Promise.all([
    product('event_id', event.id),
    ...(event.series_key === null ? [] : [product('series_key', event.series_key)]),
  ])
  return results.some((r) => r.error !== null || (r.data ?? []).length > 0)
}
