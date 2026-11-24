import { createHash, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { importAllSeries } from '@/lib/server/zoom/sessions'

/** Scheduled work that needs Node (ADR-018). pg_cron posts here. */
type Job = (supabase: ReturnType<typeof createServiceClient>) => Promise<unknown>
const JOBS = new Map<string, Job>([['zoom-import-sessions', importAllSeries]])

const digest = (value: string) => createHash('sha256').update(value).digest()

export async function POST(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.SYNC_SECRET
  const given = req.headers.get('x-sync-secret')
  // Hashing first gives equal lengths, so the comparison leaks nothing.
  if (!secret || given === null || !timingSafeEqual(digest(given), digest(secret))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { job } = await params
  const run = JOBS.get(job)
  if (run === undefined) return Response.json({ error: 'Unknown job' }, { status: 404 })
  try {
    return Response.json({ ok: true, result: await run(createServiceClient()) })
  } catch (err) {
    console.error('[job]', job, err instanceof Error ? err.name : 'error')
    return Response.json({ error: 'Job failed' }, { status: 500 })
  }
}
