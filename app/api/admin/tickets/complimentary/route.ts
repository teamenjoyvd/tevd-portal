import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { issueComplimentaryPass } from '@/lib/server/tickets/passes'
import { ticketErrorCode } from '@/lib/server/tickets/errors'

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ENTRIES = 100

type Input = { productId: string; name: string; email: string; entries: number; expiresAt: string }

function parseBody(body: unknown): Input | null {
  if (typeof body !== 'object' || body === null) return null
  const { product_id, name, email, entries, expires_at } = body as Record<string, unknown>
  if (typeof product_id !== 'string' || !UUID.test(product_id)) return null
  if (typeof name !== 'string' || name.trim() === '' || name.length > 200) return null
  if (typeof email !== 'string' || email.length > 320 || !EMAIL.test(email.trim())) return null
  if (typeof entries !== 'number' || !Number.isInteger(entries) || entries < 1 || entries > MAX_ENTRIES) return null
  if (typeof expires_at !== 'string') return null
  const expiry = Date.parse(expires_at)
  if (Number.isNaN(expiry) || expiry <= Date.now()) return null
  return {
    productId: product_id,
    name: name.trim(),
    email: email.trim(),
    entries,
    expiresAt: new Date(expiry).toISOString(),
  }
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const input = parseBody(await req.json().catch(() => null))
  if (input === null) return Response.json({ error: 'Invalid request', code: 'invalid_input' }, { status: 400 })

  const { data, error } = await issueComplimentaryPass(supabase, { ...input, actorId: ctx.profile.id })
  if (error || data === null) {
    const code = ticketErrorCode(error)
    if (code !== null) {
      return Response.json({ error: 'Could not issue the pass', code }, { status: code === 'not_found' ? 404 : 400 })
    }
    console.error('[POST /api/admin/tickets/complimentary]', error?.code)
    return Response.json({ error: 'Could not issue the pass' }, { status: 500 })
  }
  // qr_token stays on the server: the QR image is the only way out for it (#776).
  return Response.json(
    {
      id: data.id,
      unlock_code: data.unlock_code,
      holder_name: data.holder_name,
      entries_total: data.entries_total,
      expires_at: data.expires_at,
    },
    { status: 201 },
  )
}
