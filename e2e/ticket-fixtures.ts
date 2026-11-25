import { expect, type APIRequestContext } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomInt, randomUUID } from 'crypto'
import { isSafeSupabaseTarget } from '../scripts/lib/safe-supabase-target'
import { fromSofiaLocalInput, todayInSofia } from '../lib/format'
import { E2E_SYNC_SECRET, FAKE_URL, FAKE_WEBINAR } from './fakes/config.mjs'

type Registrant = { id: string; session: string; email: string; name: string; status: string; link: string }
type Email = { id: string; to: string | string[]; subject: string; html: string }
export type FakeState = { registrants: Registrant[]; emails: Email[]; requests: { method: string; path: string }[] }

async function fake(path: string, body?: unknown): Promise<Response> {
  return fetch(`${FAKE_URL}${path}`, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) })
}

/** A reused dev server was started without the fakes: its Zoom and emails would be real. */
export async function requireFakes(request: APIRequestContext): Promise<void> {
  const res = await request.post('/api/internal/jobs/e2e-probe', { headers: { 'x-sync-secret': E2E_SYNC_SECRET } })
  expect(
    res.status(),
    'The dev server on :3400 runs without the E2E fakes. Stop it (find it with `lsof -ti :3400`) and let Playwright start its own.',
  ).toBe(404)
  expect((await fake('/health')).status).toBe(200)
}

export function randomIp(): string {
  return `198.18.${randomInt(256)}.${randomInt(1, 255)}`
}

/** Everything a run creates hangs off its own events and email addresses, and `cleanup` removes it. */
export class TicketRun {
  readonly id = randomUUID().slice(0, 8)
  readonly sb: SupabaseClient
  private events: { id: string; session: string }[] = []

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    if (!isSafeSupabaseTarget(url)) throw new Error('Ticket specs need local or DEV Supabase')
    this.sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')
  }

  email(who: string): string {
    return `e2e-ticket-${this.id}-${who}@example.com`
  }

  async event(fields: Record<string, unknown> = {}): Promise<{ id: string; session: string; title: string }> {
    const session = `e2e-${this.id}-${this.events.length}`
    const title = `E2E Ticket ${session}`
    const midnight = Date.parse(fromSofiaLocalInput(`${todayInSofia()}T00:00`))
    const { data, error } = await this.sb
      .from('calendar_events')
      .insert({
        title,
        source: 'zoom',
        start_time: new Date(Math.max(Date.now() - 5 * 60_000, midnight)).toISOString(),
        end_time: new Date(Date.now() + 2 * 3_600_000).toISOString(),
        week_number: 1,
        access_roles: ['guest', 'member', 'core', 'admin'],
        zoom_event_ref: FAKE_WEBINAR,
        zoom_session_ref: session,
        ...fields,
      })
      .select('id')
      .single()
    if (error) throw error
    this.events.push({ id: data.id, session })
    return { id: data.id, session, title }
  }

  async product(eventId: string, kind: 'single' | 'pack' | 'free_registration'): Promise<string> {
    const { data, error } = await this.sb
      .from('ticket_products')
      .insert({ event_id: eventId, kind, price_cents: kind === 'free_registration' ? 0 : 500, entries: kind === 'pack' ? 5 : 1 })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }

  async state(): Promise<FakeState> {
    return (await fake('/state')).json()
  }

  /** Emails arrive after the response, so wait for them. */
  async emailsTo(address: string, atLeast = 1): Promise<Email[]> {
    let found: Email[] = []
    await expect
      .poll(async () => {
        found = (await this.state()).emails.filter((e) => [e.to].flat().includes(address))
        return found.length
      }, { timeout: 20_000, message: `emails to ${address}` })
      .toBeGreaterThanOrEqual(atLeast)
    return found
  }

  async failZoom(session: string, method: 'POST' | 'PUT' | 'DELETE', status = 500, times = 1): Promise<void> {
    await fake('/fail', { session, method, status, times })
  }

  async runJob(request: APIRequestContext, job: string): Promise<void> {
    const res = await request.post(`/api/internal/jobs/${job}`, { headers: { 'x-sync-secret': E2E_SYNC_SECRET } })
    expect(res.status(), job).toBe(200)
  }

  async cleanup(): Promise<void> {
    const ok = async (step: PromiseLike<{ error: unknown }>) => {
      const { error } = await step
      if (error) throw error
    }
    const ids = this.events.map((e) => e.id)
    const select = async (table: string, column: string, values: string[]) => {
      if (values.length === 0) return [] as string[]
      const { data, error } = await this.sb.from(table).select('id').in(column, values)
      if (error) throw error
      return data.map((r) => r.id as string)
    }
    const products = await select('ticket_products', 'event_id', ids)
    const passes = await select('ticket_passes', 'product_id', products)
    const admissions = await select('ticket_admissions', 'event_id', ids)
    if (admissions.length > 0) await ok(this.sb.from('ticket_audit').delete().in('admission_id', admissions))
    if (passes.length > 0) await ok(this.sb.from('ticket_audit').delete().in('pass_id', passes))
    if (admissions.length > 0) await ok(this.sb.from('ticket_admissions').delete().in('id', admissions))
    if (passes.length > 0) await ok(this.sb.from('ticket_passes').delete().in('id', passes))
    if (products.length > 0) await ok(this.sb.from('ticket_orders').delete().in('product_id', products))
    if (products.length > 0) await ok(this.sb.from('ticket_products').delete().in('id', products))
    if (ids.length > 0) await ok(this.sb.from('calendar_events').delete().in('id', ids))
    await ok(this.sb.from('notification_delivery_log').delete().like('recipient', `e2e-ticket-${this.id}-%`))
    for (const { session } of this.events) await fake('/forget', { session, emailPart: `e2e-ticket-${this.id}-` })
  }
}
