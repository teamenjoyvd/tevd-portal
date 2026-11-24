import { z } from 'zod'

/**
 * The only code that talks to Zoom (ADR-017). Server-only.
 *
 * Errors never carry response bodies or URLs: both can hold attendee details.
 */
export class ZoomError extends Error {
  constructor(
    public kind: 'retryable' | 'permanent',
    public status: number,
    public zoomCode?: number,
  ) {
    super(`Zoom ${kind} error ${status}${zoomCode === undefined ? '' : ` (${zoomCode})`}`)
    this.name = `ZoomError_${kind}_${status}`
  }
}

export function isZoomConfigured(): boolean {
  return Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET)
}

/** There is one Zoom account, so outside production only listed webinars may be touched. */
export function assertEventAllowed(eventRef: string): void {
  if (!/^\d{9,12}$/.test(eventRef)) throw new ZoomError('permanent', 400)
  if (process.env.VERCEL_ENV === 'production') return
  const allowed = (process.env.ZOOM_ALLOWED_EVENT_IDS ?? '').split(',').map((id) => id.replace(/\s/g, ''))
  if (!allowed.includes(eventRef)) throw new ZoomError('permanent', 403)
}

const TIMEOUT_MS = 15_000
const EARLY_MS = 60_000
let cached: { token: string; expiresAt: number } | null = null

export function resetTokenCache(): void {
  cached = null
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new ZoomError('retryable', 0)
  }
}

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number() })

async function getToken(): Promise<string> {
  if (cached !== null && cached.expiresAt - Date.now() > EARLY_MS) return cached.token
  if (!isZoomConfigured()) throw new ZoomError('permanent', 0)
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env
  const res = await send(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID ?? '')}`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')}` },
    },
  )
  if (!res.ok) throw new ZoomError(res.status >= 500 || res.status === 429 ? 'retryable' : 'permanent', res.status)
  const parsed = tokenSchema.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new ZoomError('permanent', res.status)
  cached = { token: parsed.data.access_token, expiresAt: Date.now() + parsed.data.expires_in * 1000 }
  return cached.token
}

const errorSchema = z.object({ code: z.number().optional(), message: z.string().optional() })

async function toError(res: Response): Promise<ZoomError> {
  const body = errorSchema.safeParse(await res.json().catch(() => null))
  const code = body.success ? body.data.code : undefined
  // The daily registrant limit answers 429 until 00:00 UTC: retrying only burns the claim.
  const daily = body.success && /daily|per day|within one day/i.test(body.data.message ?? '')
  const retryable = res.status >= 500 || (res.status === 429 && !daily)
  return new ZoomError(retryable ? 'retryable' : 'permanent', res.status, code)
}

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  const once = async () =>
    send(`https://api.zoom.us/v2${path}`, {
      method,
      headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  let res = await once()
  if (res.status === 401) {
    resetTokenCache()
    res = await once()
  }
  if (!res.ok) throw await toError(res)
  return res
}

async function parse<T>(res: Response, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new ZoomError('permanent', res.status)
  return parsed.data
}

const webinarSchema = z.object({
  topic: z.string(),
  type: z.number(),
  settings: z.object({ registration_type: z.number().optional(), approval_type: z.number().optional() }),
  occurrences: z
    .array(z.object({ occurrence_id: z.string(), start_time: z.string(), duration: z.number(), status: z.string() }))
    .default([]),
})
export type ZoomWebinar = z.infer<typeof webinarSchema>

export async function getWebinar(eventRef: string): Promise<ZoomWebinar> {
  assertEventAllowed(eventRef)
  return parse(await call('GET', `/webinars/${eventRef}`), webinarSchema)
}

const registrantSchema = z.object({ registrant_id: z.string().min(1), join_url: z.url() })

/** Same email and session returns the same registration; the name sent last wins. */
export async function createRegistrant(
  eventRef: string,
  sessionRef: string,
  person: { email: string; first_name: string; last_name: string },
) {
  assertEventAllowed(eventRef)
  const query = new URLSearchParams({ occurrence_ids: sessionRef })
  return parse(await call('POST', `/webinars/${eventRef}/registrants?${query}`, person), registrantSchema)
}

export async function approveRegistrant(eventRef: string, sessionRef: string, id: string, email: string) {
  assertEventAllowed(eventRef)
  const query = new URLSearchParams({ occurrence_id: sessionRef })
  await call('PUT', `/webinars/${eventRef}/registrants/status?${query}`, {
    action: 'approve',
    registrants: [{ id, email }],
  })
}

/** DELETE, never `action: cancel`: a cancelled person cannot be registered again. */
export async function deleteRegistrant(eventRef: string, sessionRef: string, id: string) {
  assertEventAllowed(eventRef)
  const query = new URLSearchParams({ occurrence_id: sessionRef })
  try {
    await call('DELETE', `/webinars/${eventRef}/registrants/${encodeURIComponent(id)}?${query}`)
  } catch (err) {
    // Already gone is what the caller wanted.
    if (!(err instanceof ZoomError && err.status === 404)) throw err
  }
}
