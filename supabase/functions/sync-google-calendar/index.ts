import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function getGoogleAccessToken(sa: Record<string,string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const b64u = (o: unknown) => btoa(JSON.stringify(o)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const header  = b64u({alg:'RS256',typ:'JWT'})
  const payload = b64u({iss:sa.client_email,scope:'https://www.googleapis.com/auth/calendar.readonly',aud:'https://oauth2.googleapis.com/token',exp:now+3600,iat:now})
  const input   = header + '.' + payload
  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\\n/g,'')),c=>c.charCodeAt(0)),
    {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},
    false,
    ['sign'],
  )
  const sigBytes = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(input)))
  const sig = btoa(String.fromCharCode(...sigBytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: input + '.' + sig,
    }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(d))
  return d.access_token
}

/**
 * Return a Date whose UTC year/month/day matches the Sofia calendar date of `date`.
 * Used to compute ISO week numbers in Sofia local time rather than UTC.
 * Intl.DateTimeFormat with numeric parts is specified behaviour — safe in Deno/V8.
 */
function sofiaDateFor(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Sofia',
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date)
  const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value, 10)
  // Date.UTC month is 0-indexed
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')))
}

function isoWeek(date: Date): number {
  const d = new Date(date)
  d.setUTCHours(0,0,0,0)
  d.setUTCDate(d.getUTCDate()+3-((d.getUTCDay()+6)%7))
  const w1 = new Date(Date.UTC(d.getUTCFullYear(),0,4))
  return 1+Math.round(((d.getTime()-w1.getTime())/86400000-3+((w1.getUTCDay()+6)%7))/7)
}

/**
 * Extract meeting URL from a GCal event item.
 * Priority: conferenceData.entryPoints (video type) > fallback to first href in description HTML.
 * conferenceDataVersion=1 must be set on the API request for this field to be present.
 */
function extractMeetingUrl(
  item: Record<string, unknown>,
  rawDesc: string | null,
): string | null {
  // 1. conferenceData.entryPoints — Google Meet, Zoom via GCal, etc.
  const conferenceData = item.conferenceData as Record<string, unknown> | undefined
  if (conferenceData) {
    const entryPoints = conferenceData.entryPoints as Array<Record<string, unknown>> | undefined
    if (Array.isArray(entryPoints)) {
      const video = entryPoints.find(e => e.entryPointType === 'video')
      const uri = video?.uri ?? entryPoints[0]?.uri
      if (typeof uri === 'string') return uri
    }
  }
  // 2. Fallback: first href in description HTML (for manually-pasted links)
  if (rawDesc) {
    const m = rawDesc.match(/href=["']([^"']+)["']/i)
    if (m) return m[1]
  }
  return null
}

/** Strip all HTML tags and decode common HTML entities. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

/**
 * Resolve start/end times for a GCal event item.
 *
 * Google returns two distinct shapes:
 *   - Timed events:   { start: { dateTime: '2026-06-15T10:00:00+02:00' }, end: { dateTime: ... } }
 *   - All-day events: { start: { date: '2026-06-15' }, end: { date: '2026-06-16' } }
 *
 * The `date` form is a bare YYYY-MM-DD string. Passing it directly to
 * new Date(...) parses it as UTC midnight, which in Sofia (UTC+2) shifts
 * the event to the previous day at 22:00.
 *
 * Fix: detect all-day by absence of dateTime, then build an explicit
 * Sofia-midnight ISO string using the +02:00 offset. This produces the
 * correct UTC instant (e.g. 2026-06-14T22:00:00.000Z) while preserving
 * the correct calendar date when rendered in the Sofia timezone.
 *
 * Google's end.date is EXCLUSIVE (the day after the last day of the event).
 * We subtract one day so a single-day event stores start=Jun 15, end=Jun 15
 * and a two-day event stores start=Jun 15, end=Jun 16.
 */
function resolveTimes(item: Record<string, unknown>): {
  startIso: string
  endIso: string
  isAllDay: boolean
} {
  const start = item.start as Record<string, string> | undefined
  const end   = item.end   as Record<string, string> | undefined

  if (start?.dateTime && end?.dateTime) {
    // Timed event — dateTime already carries timezone offset, safe to use as-is.
    return {
      startIso: new Date(start.dateTime).toISOString(),
      endIso:   new Date(end.dateTime).toISOString(),
      isAllDay: false,
    }
  }

  if (start?.date && end?.date) {
    // All-day event — construct explicit Sofia midnight strings.
    // +02:00 is Sofia standard time (EET). EEST (+03:00) applies May–Oct;
    // using +02:00 year-round is a deliberate simplification: the stored
    // UTC instant may be off by 1h during summer but the rendered Sofia
    // calendar date will always be correct because the display layer reads
    // back through the Europe/Sofia TZ (which applies DST automatically).
    const startIso = new Date(`${start.date}T00:00:00+02:00`).toISOString()

    // Subtract one day from Google's exclusive end date.
    // exclusiveEnd is initialised as Sofia midnight (22:00 UTC); setDate adjusts
    // the UTC date by -1, yielding the correct Sofia midnight for the inclusive
    // end day. toISOString() on the resulting Date is the correct UTC instant.
    const exclusiveEnd = new Date(`${end.date}T00:00:00+02:00`)
    exclusiveEnd.setDate(exclusiveEnd.getDate() - 1)
    const endIso = exclusiveEnd.toISOString()

    return { startIso, endIso, isAllDay: true }
  }

  // Malformed item — fall back to empty strings so the caller can skip it.
  return { startIso: '', endIso: '', isAllDay: false }
}

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('SYNC_SECRET')
  if (secret && req.headers.get('x-sync-secret') !== secret) {
    return new Response(JSON.stringify({error:'Unauthorized'}), {status:401})
  }

  const sa    = Deno.env.get('GOOGLE_SERVICE_ACCOUNT')
  const calId = Deno.env.get('GOOGLE_CALENDAR_ID')
  if (!sa || !calId) {
    return new Response(JSON.stringify({error:'Missing env secrets'}), {status:500})
  }

  let token: string
  try { token = await getGoogleAccessToken(JSON.parse(sa)) }
  catch(e) { return new Response(JSON.stringify({error:'auth_failed',detail:String(e)}),{status:500}) }

  const sb   = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const tMin = new Date().toISOString()
  const tMax = new Date(Date.now()+180*864e5).toISOString()
  const url  = new URL('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calId) + '/events')
  url.searchParams.set('timeMin', tMin)
  url.searchParams.set('timeMax', tMax)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '100')
  // Required to receive conferenceData (Google Meet links) in the response
  url.searchParams.set('conferenceDataVersion', '1')

  const calRes = await fetch(url.toString(), {headers: {Authorization: 'Bearer ' + token}})
  if (!calRes.ok) return new Response(JSON.stringify({error:'calendar_api_failed',detail:await calRes.text()}),{status:500})

  const items: Record<string,unknown>[] = (await calRes.json()).items ?? []
  let upserted = 0, newEvents = 0
  const errors: string[] = []

  for (const item of items) {
    if (item.status === 'cancelled') continue

    const { startIso, endIso, isAllDay } = resolveTimes(item)
    if (!startIso || !endIso) continue

    const st = new Date(startIso)
    const personal = String(item.summary??'').includes('[Personal]') || String(item.description??'').includes('[Personal]')

    const rawDesc    = item.description ? String(item.description) : null
    const meetingUrl = extractMeetingUrl(item, rawDesc)
    const cleanDesc  = rawDesc ? (stripHtml(rawDesc) || null) : null
    const location   = typeof item.location === 'string' && item.location ? item.location : null

    const {data:ex} = await sb.from('calendar_events').select('id').eq('google_event_id', item.id).maybeSingle()

    const eventPayload = {
      title:       String(item.summary ?? 'Untitled'),
      description: cleanDesc,
      meeting_url: meetingUrl,
      location:    location,
      start_time:  startIso,
      end_time:    endIso,
      week_number: isoWeek(sofiaDateFor(st)),
      is_all_day:  isAllDay,
    }

    if (!ex) {
      // New event: full insert including category and access_roles
      const {error:ie} = await sb.from('calendar_events').insert({
        ...eventPayload,
        google_event_id: item.id,
        category:        personal ? 'Personal' : 'N21',
        access_roles:    personal ? ['member','core','admin'] : ['admin','core','member','guest'],
      })
      if (ie) errors.push(String(item.id) + ': ' + ie.message)
      else { upserted++; newEvents++ }
    } else {
      // Existing event: update scheduling, content, and is_all_day.
      // category and access_roles are intentionally not touched here
      // (admins may have customised them after the initial sync).
      const {error:ue} = await sb.from('calendar_events')
        .update(eventPayload)
        .eq('google_event_id', item.id)
      if (ue) errors.push(String(item.id) + ': ' + ue.message)
      else upserted++
    }
  }

  if (newEvents > 0) {
    const {data:profiles} = await sb.from('profiles').select('id').in('role',['member','core','admin'])
    if (profiles?.length) {
      await sb.from('notifications').insert(
        profiles.map((p:{id:string}) => ({
          profile_id: p.id,
          type:       'event_fetched',
          title:      'New events added',
          message:    newEvents + ' new event' + (newEvents > 1 ? 's' : '') + ' added to the calendar.',
          action_url: '/calendar',
        }))
      )
    }
  }

  return new Response(JSON.stringify({upserted, new_events: newEvents, errors}), {
    headers: {'Content-Type': 'application/json'},
  })
})
