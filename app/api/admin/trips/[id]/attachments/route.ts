import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { NextRequest, NextResponse } from 'next/server'

// POST handler removed — upload flow now uses signed URL via
// GET  /api/admin/trips/[id]/upload-url
// POST /api/admin/trips/[id]/upload-url/confirm

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const ctx = await getCallerContext(userId, supabase, 'admin')
  if (ctx.guard) return ctx.guard

  const { id: tripId } = await params

  const { data, error } = await supabase
    .from('trip_attachments')
    .select('id, file_url, file_name, file_type, sort_order, created_at')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
