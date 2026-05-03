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

function isoWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0,0,0,0)
  d.setDate(d.getDate()+3-((d.getDay()+6)%7))
  const w1 = new Date(d.getFullYear(),0,4)
  return 1+Math.round(((d.getTime()-w1.getTime())/86400000-3+((w1.getDay()+6)%7))/7)
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
    const startRaw = (item.start as Record<string,string>)?.dateTime ?? (item.start as Record<string,string>)?.date
    const endRaw   = (item.end   as Record<string,string>)?.dateTime ?? (item.end   as Record<string,string>)?.date
    if (!startRaw || !endRaw) continue
    const st = new Date(startRaw), et = new Date(endRaw)
    const personal = String(item.summary??'').includes('[Personal]') || String(item.description??'').includes('[Personal]')

    const rawDesc    = item.description ? String(item.description) : null
    const meetingUrl = extractMeetingUrl(item, rawDesc)
    const cleanDesc  = rawDesc ? (stripHtml(rawDesc) || null) : null

    const {data:ex} = await sb.from('calendar_events').select('id').eq('google_event_id', item.id).maybeSingle()
    const {error:ue} = await sb.from('calendar_events').upsert({
      google_event_id:  item.id,
      title:            String(item.summary ?? 'Untitled'),
      description:      cleanDesc,
      meeting_url:      meetingUrl,
      start_time:       st.toISOString(),
      end_time:         et.toISOString(),
      category:         personal ? 'Personal' : 'N21',
      access_roles:     personal ? ['member','core','admin'] : ['admin','core','member','guest'],
      week_number:      isoWeek(st),
    }, {onConflict: 'google_event_id'})
    if (ue) errors.push(String(item.id) + ': ' + ue.message)
    else { upserted++; if (!ex) newEvents++ }
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
