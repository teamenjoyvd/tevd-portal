import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_id', userId)
    .single()

  if (error) {
    // PGRST116 = no rows returned — user has no profile yet (webhook not fired)
    if (error.code === 'PGRST116') {
      return Response.json({ error: 'Profile not found' }, { status: 404 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data)
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const body = await req.json()

  // Whitelist updatable fields — clerk_id, role, abo_number not patchable here
  const allowed = [
    'first_name', 'last_name', 'display_names',
    'document_active_type',
    'id_number', 'passport_number', 'valid_through',
    'phone', 'contact_email',
  ]
  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('clerk_id', userId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
