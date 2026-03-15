import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: admin } = await supabase
    .from('profiles').select('role').eq('clerk_id', userId).single()
  if (admin?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, clerk_id, abo_number, role,
      first_name, last_name, display_names,
      document_active_type, valid_through,
      created_at,
      tree_nodes (path, depth)
    `)
    .order('last_name')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}