import { createServiceClient } from '@/lib/supabase/service'

export const revalidate = 300 // 5 min

export async function GET() {
  // Resilient by design: this route is prerendered at build (revalidate above),
  // so a missing-env build shell or a transient DB error must degrade to an empty
  // post rather than crash the build. Prod keeps the 5-min ISR behaviour.
  try {
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
  } catch {
    return Response.json({ post: null })
  }
}
