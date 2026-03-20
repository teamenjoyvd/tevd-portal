import { createServiceClient } from '@/lib/supabase/service'

export const revalidate = 300 // 5 min

export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('is_visible', true)
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return Response.json({ post: null })
  return Response.json({ post: data })
}
