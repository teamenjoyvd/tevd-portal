import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

async function resolveAdmin(userId: string) {
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()
  return { supabase, profile }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, profile } = await resolveAdmin(userId)
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { messageId } = await params

  const body = await req.json().catch(() => null)
  if (!body?.body || typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  const { data: message, error } = await supabase
    .from('trip_messages')
    .update({ body: body.body.trim() })
    .eq('id', messageId)
    .select('id, body, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(message)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { supabase, profile } = await resolveAdmin(userId)
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { messageId } = await params

  const { error } = await supabase
    .from('trip_messages')
    .delete()
    .eq('id', messageId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
