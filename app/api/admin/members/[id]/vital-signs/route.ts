import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: memberId } = await params

  const [{ data: definitions, error: defError }, { data: recorded, error: recError }] =
    await Promise.all([
      supabase
        .from('vital_sign_definitions')
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from('member_vital_signs')
        .select('definition_id, recorded_at, is_active, note')
        .eq('profile_id', memberId),
    ])

  if (defError) return Response.json({ error: defError.message }, { status: 500 })
  if (recError) return Response.json({ error: recError.message }, { status: 500 })

  const recordedMap = new Map(
    (recorded ?? []).map((r) => [r.definition_id, r])
  )

  const result = (definitions ?? []).map((def) => {
    const entry = recordedMap.get(def.id)
    return {
      ...def,
      is_recorded: !!entry,
      is_active: entry?.is_active ?? false,
      recorded_at: entry?.recorded_at ?? null,
      note: entry?.note ?? null,
    }
  })

  return Response.json(result)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: adminProfile } = await supabase
    .from('profiles').select('id, role').eq('clerk_id', userId).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id: memberId } = await params
  const body: { definition_id: string; recorded_at?: string; note?: string } = await req.json()

  if (!body.definition_id) {
    return Response.json({ error: 'definition_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('member_vital_signs')
    .upsert(
      {
        profile_id:    memberId,
        definition_id: body.definition_id,
        is_active:     true,
        recorded_at:   body.recorded_at ?? new Date().toISOString().split('T')[0],
        recorded_by:   adminProfile.id,
        note:          body.note ?? null,
      },
      { onConflict: 'profile_id,definition_id' }
    )
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
