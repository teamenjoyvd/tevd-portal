import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { isZoomConfigured, ZoomError } from '@/lib/server/zoom/client'
import { importSeries } from '@/lib/server/zoom/sessions'

const bodySchema = z.object({
  series_key: z.string().min(1).max(50),
  zoom_id: z.string().transform((v) => v.replace(/\s/g, '')).pipe(z.string().regex(/^\d{9,12}$/)),
  event_type: z.enum(['in-person', 'online', 'hybrid']),
  in_person_capacity: z.number().int().min(0).max(100_000).nullable(),
  online_capacity: z.number().int().min(0).max(100).nullable(),
})

async function seriesKeys(supabase: ReturnType<typeof createServiceClient>): Promise<string[]> {
  const { data, error } = await supabase.from('ticket_products').select('series_key').not('series_key', 'is', null)
  if (error) throw error
  return [...new Set(data.flatMap((p) => (p.series_key === null ? [] : [p.series_key])))].sort()
}

async function admin() {
  const { userId } = await auth()
  if (!userId) return { guard: Response.json({ error: 'Unauthorized' }, { status: 401 }), supabase: null }
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  return ctx.guard ? { guard: ctx.guard, supabase: null } : { guard: null, supabase }
}

export async function GET() {
  const { guard, supabase } = await admin()
  if (guard) return guard
  return Response.json({ configured: isZoomConfigured(), series_keys: await seriesKeys(supabase) })
}

/** Links a Zoom webinar series. Reads Zoom, never writes to it. */
export async function POST(req: Request) {
  const { guard, supabase } = await admin()
  if (guard) return guard
  if (!isZoomConfigured()) return Response.json({ error: 'Zoom is not configured', code: 'not_configured' }, { status: 503 })

  const body = bodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return Response.json({ error: 'Invalid request', code: 'invalid_input' }, { status: 400 })
  if (!(await seriesKeys(supabase)).includes(body.data.series_key)) {
    return Response.json({ error: 'Unknown series', code: 'invalid_input' }, { status: 400 })
  }

  try {
    const result = await importSeries(supabase, {
      eventRef: body.data.zoom_id,
      seriesKey: body.data.series_key,
      eventType: body.data.event_type,
      inPersonCapacity: body.data.in_person_capacity,
      onlineCapacity: body.data.online_capacity,
    })
    if (!result.ok) return Response.json({ error: 'Cannot link this webinar', code: result.code }, { status: 409 })
    return Response.json(result)
  } catch (err) {
    if (err instanceof ZoomError) {
      const code = err.status === 403 ? 'not_allowed' : err.status === 404 ? 'not_found' : 'zoom_error'
      return Response.json({ error: 'Zoom refused the request', code }, { status: 502 })
    }
    console.error('[POST /api/admin/zoom/series]', err instanceof Error ? err.name : 'error')
    return Response.json({ error: 'Could not link the series' }, { status: 500 })
  }
}
