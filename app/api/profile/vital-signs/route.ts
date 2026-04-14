import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!profile?.id) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Fetch the full definition matrix, then left-join recorded rows.
  // Returns one entry per definition regardless of whether a member_vital_signs
  // row exists, matching the admin GET pattern used by the LOS tree endpoint.
  const { data: definitions, error: defError } = await supabase
    .from('vital_sign_definitions')
    .select('id, category, label, sort_order')
    .order('sort_order', { ascending: true })

  if (defError) return Response.json({ error: defError.message }, { status: 500 })

  const { data: recorded, error: recError } = await supabase
    .from('member_vital_signs')
    .select('id, definition_id, is_active, recorded_at, note, created_at')
    .eq('profile_id', profile.id)

  if (recError) return Response.json({ error: recError.message }, { status: 500 })

  const recordedByDefinition = Object.fromEntries(
    (recorded ?? []).map(r => [r.definition_id, r])
  )

  const result = (definitions ?? []).map(def => {
    const row = recordedByDefinition[def.id] ?? null
    return {
      id: row?.id ?? def.id,
      definition_id: def.id,
      is_recorded: row !== null,
      is_active: row?.is_active ?? false,
      recorded_at: row?.recorded_at ?? null,
      note: row?.note ?? null,
      created_at: row?.created_at ?? null,
      vital_sign_definitions: {
        category: def.category,
        label: def.label,
        sort_order: def.sort_order,
      },
    }
  })

  return Response.json(result)
}
