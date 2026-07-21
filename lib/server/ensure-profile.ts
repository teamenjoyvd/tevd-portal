import { cache } from 'react'
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database, Tables, TablesInsert } from '@/types/supabase'

type ProfileRole = Database['public']['Enums']['user_role']
type ServiceClient = SupabaseClient<Database>

// Runtime whitelist of the `user_role` enum. An unrecognized value from Clerk
// `public_metadata.role` (typo, stale custom value) would otherwise reach the
// DB enum and fail the whole write — clamp it to the lowest role instead.
const VALID_ROLES: readonly ProfileRole[] = ['admin', 'core', 'member', 'guest']

function coerceRole(role: string | null | undefined): ProfileRole {
  return VALID_ROLES.includes(role as ProfileRole) ? (role as ProfileRole) : 'guest'
}

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
  const aboNumber = input.aboNumber ?? null

  // DB invariant (fn_guard_abo_number_null, migration 20260716000100): a
  // primary profile with role 'member' or 'core' MUST have an abo_number, or
  // the write is rejected (P0001). Freshly-created rows are always primary
  // (no co-owner link yet), so without an ABO we cannot persist those roles —
  // fall back to 'guest', the pre-ABO-verification state the user promotes
  // out of by confirming their ABO on /profile. Admin is exempt per the
  // trigger. (Without this, a Clerk user whose metadata says 'member' but who
  // has no ABO could never get a profile row — the webhook fails the same way.)
  let role = coerceRole(input.role)
  if ((role === 'member' || role === 'core') && !aboNumber) role = 'guest'

  return {
    clerk_id: input.clerkId,
    first_name: first,
    last_name: last,
    role,
    abo_number: aboNumber,
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

    // Best-effort enrichment from Clerk. currentUser() hits the Clerk Backend
    // API (used nowhere else in this app) and can throw on a transient outage
    // or a config gap. The row MUST still be created, so treat this as
    // optional: on failure fall back to a minimal guest row — names/role fill
    // in later via the webhook (user.updated) or when the user edits their
    // profile. (A throw here previously fell through to loadProfile's
    // redirect('/'), reproducing the original bug.)
    let user: Awaited<ReturnType<typeof currentUser>> = null
    try {
      user = await currentUser()
    } catch {
      user = null
    }
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

  // No row (or a transient read error) — self-heal, then re-run the caller's
  // projected select. If the heal itself fails (e.g. a Clerk API outage during
  // currentUser(), or a rejected write), degrade to home rather than crashing
  // the render: home tolerates a missing profile (defaults to 'guest').
  try {
    await ensureProfile(userId)
    const second = await supabase
      .from('profiles')
      .select(select)
      .eq('clerk_id', userId)
      .single()
    if (second.data) {
      return { userId, supabase, profile: second.data as T }
    }
  } catch {
    // fall through to the home redirect below
  }
  redirect('/')
}
