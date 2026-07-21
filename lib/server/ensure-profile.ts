import { cache } from 'react'
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database, Tables, TablesInsert } from '@/types/supabase'

type ProfileRole = Database['public']['Enums']['user_role']
type ServiceClient = SupabaseClient<Database>

/**
 * Single source of truth for the columns written when a `profiles` row is
 * first created, shared by the Clerk webhook (app/api/webhooks/clerk/route.ts)
 * and the self-heal path below so the two writers can never drift.
 *
 * New registrations start as 'guest' — promoted to 'member' after ABO
 * verification. Only Clerk `public_metadata.role` can seed a higher role, so
 * self-heal never escalates privilege on its own.
 */
export function buildProfileRow(input: {
  clerkId: string
  firstName?: string | null
  lastName?: string | null
  role?: string | null
  aboNumber?: string | null
}): TablesInsert<'profiles'> {
  const first = input.firstName ?? ''
  const last = input.lastName ?? ''
  return {
    clerk_id: input.clerkId,
    first_name: first,
    last_name: last,
    role: (input.role as ProfileRole) ?? 'guest',
    abo_number: input.aboNumber ?? null,
    display_names: { en: `${first} ${last}`.trim() },
  }
}

/**
 * Guarantees a `profiles` row exists for `userId` and returns it.
 *
 * The app's only other `profiles` writer is the Clerk `user.created` webhook,
 * which is asynchronous: a user who reaches the app before it lands (sign-up →
 * navigate race), or whose webhook was missed/failed, has no row. This heals
 * that gap on read instead of bouncing the user.
 *
 * Idempotent and safe under the webhook-vs-page race: the insert is an upsert
 * on the `clerk_id` unique constraint, so a concurrent writer is a no-op merge
 * (no duplicate row). Wrapped in React `cache()` so the page plus its child
 * data-loaders share a single heal per request.
 */
export const ensureProfile = cache(
  async (userId: string): Promise<Tables<'profiles'>> => {
    const supabase = createServiceClient()

    const { data: existing, error: readError } = await supabase
      .from('profiles')
      .select('*')
      .eq('clerk_id', userId)
      .single()

    if (existing) return existing
    // PGRST116 = "no rows"; any other error is a real DB fault, not a missing row.
    if (readError && readError.code !== 'PGRST116') throw readError

    const user = await currentUser()
    const meta = user?.publicMetadata as
      | { role?: string; abo_number?: string }
      | undefined

    const row = buildProfileRow({
      clerkId: userId,
      firstName: user?.firstName,
      lastName: user?.lastName,
      role: meta?.role ?? null,
      aboNumber: meta?.abo_number ?? null,
    })

    const { data: created, error: writeError } = await supabase
      .from('profiles')
      .upsert(row, { onConflict: 'clerk_id' })
      .select('*')
      .single()

    if (writeError || !created) {
      throw writeError ?? new Error('ensureProfile: upsert returned no row')
    }
    return created
  }
)

export type LoadProfileResult<T> = {
  userId: string
  supabase: ServiceClient
  profile: T
}

/**
 * Server-component counterpart to `withProfile` (which is API-route-shaped and
 * returns a `Response`). Redirects unauthenticated visitors to sign-in, then
 * loads the caller's projected `select` with a guaranteed-non-null profile —
 * self-healing a missing row via `ensureProfile`. Callers no longer need an
 * `if (!profile) redirect(...)` dead end.
 *
 * Happy path is a single query; only the missing-row path pays the heal.
 */
export async function loadProfile<T = Tables<'profiles'>>(
  select = '*'
): Promise<LoadProfileResult<T>> {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const first = await supabase
    .from('profiles')
    .select(select)
    .eq('clerk_id', userId)
    .single()

  if (first.data) {
    return { userId, supabase, profile: first.data as T }
  }
  if (first.error && first.error.code !== 'PGRST116') throw first.error

  // No row yet — heal, then re-run the caller's projected select.
  await ensureProfile(userId)
  const second = await supabase
    .from('profiles')
    .select(select)
    .eq('clerk_id', userId)
    .single()

  if (second.error || !second.data) {
    throw second.error ?? new Error('loadProfile: profile missing after heal')
  }
  return { userId, supabase, profile: second.data as T }
}
