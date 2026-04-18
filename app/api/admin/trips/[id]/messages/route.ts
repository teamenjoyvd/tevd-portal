import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: tripId } = await params

  const { data: messages, error } = await supabase
    .from('trip_messages')
    .select('id, body, created_at, updated_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(messages ?? [])
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: tripId } = await params

  const body = await req.json().catch(() => null)
  if (!body?.body || typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  const { data: message, error } = await supabase
    .from('trip_messages')
    .insert({ trip_id: tripId, body: body.body.trim(), created_by: profile.id })
    .select('id, body, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(message, { status: 201 })
}
