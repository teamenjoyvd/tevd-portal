import { adminCaller, respond } from '@/lib/server/tickets/admin'
import { listAttention } from '@/lib/server/tickets/admin-views'

export async function GET() {
  const caller = await adminCaller()
  if (caller.response) return caller.response
  return respond(() => listAttention(caller.deps.supabase))
}
