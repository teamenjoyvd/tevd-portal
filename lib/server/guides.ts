// ── lib/server/guides.ts ────────────────────────────────────────────────────────────
// Single source of truth for role-scoped guides and links queries.
// Used by: /api/guides, /api/links, app/(dashboard)/guides/page.tsx (RSC).
// Server-only — never import from client components.
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Resolves the access role for the current request.
 * Falls back to 'guest' for unauthenticated or unresolvable users.
 */
export async function getRoleForAccess(): Promise<string> {
  try {
    const { userId } = await auth()
    if (!userId) return 'guest'
    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('clerk_id', userId)
      .single()
    return profile?.role ?? 'guest'
  } catch {
    return 'guest'
  }
}

export type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
  cover_image_url: string | null
  body: unknown[] | null
  access_roles: string[]
  created_at: string
}

export type SiteLink = {
  id: string
  label: { en: string; bg: string }
  url: string
  access_roles: string[]
  sort_order: number
}

/** Role-scoped published guides, newest first. */
export async function listGuidesForRole({
  role,
  limit = 100,
}: {
  role: string
  limit?: number
}): Promise<Guide[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('guides')
    .select('id, slug, title, emoji, cover_image_url, body, access_roles, created_at')
    .eq('is_published', true)
    .contains('access_roles', [role])
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as Guide[]
}

/** Role-scoped links, ordered by sort_order. */
export async function listLinksForRole({
  role,
  limit = 100,
}: {
  role: string
  limit?: number
}): Promise<SiteLink[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('links')
    .select('id, label, url, access_roles, sort_order')
    .contains('access_roles', [role])
    .order('sort_order')
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as SiteLink[]
}
