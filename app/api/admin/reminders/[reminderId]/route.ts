import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'

// PATCH body: { action: 'resend' } | { action: 'reschedule', send_at: string (ISO, future) }
export async function PATCH(req: Request, { params }: { params: Promise<{ reminderId: string }> }) {
  const { reminderId } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const body = await req.json().catch(() => null)
  if (!body || (body.action !== 'resend' && body.action !== 'reschedule')) {
    return Response.json({ error: 'Invalid or missing action' }, { status: 400 })
  }

  if (body.action === 'resend') {
    const { error } = await supabase
      .from('notification_queue')
      .update({ status: 'pending', attempts: 0, sent_at: null, last_error: null, send_at: new Date().toISOString() })
      .eq('id', reminderId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // reschedule
  if (!body.send_at || new Date(body.send_at) <= new Date()) {
    return Response.json({ error: 'Rescheduled time must be in the future' }, { status: 400 })
  }
  const { error } = await supabase
    .from('notification_queue')
    .update({ send_at: body.send_at, status: 'pending', attempts: 0, sent_at: null, last_error: null })
    .eq('id', reminderId)
    .in('status', ['pending', 'failed'])
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ reminderId: string }> }) {
  const { reminderId } = await params
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const { error } = await supabase
    .from('notification_queue')
    .delete()
    .eq('id', reminderId)
    .in('status', ['pending', 'failed'])
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
