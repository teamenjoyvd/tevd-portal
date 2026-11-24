import type { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/types/supabase'
import { generateQrToken, generateUnlockCode, normalizeUnlockCode } from './codes'

type ServiceClient = ReturnType<typeof createServiceClient>
export type TicketPass = Database['public']['Tables']['ticket_passes']['Row']

const UNIQUE_VIOLATION = '23505'

type PgResult<T> = { data: T | null; error: { code?: string; message: string } | null }

/** Codes are random, so a collision is retried with fresh ones. */
export async function withFreshCodes<T>(
  run: (codes: { unlockCode: string; qrToken: string }) => PromiseLike<PgResult<T>>,
): Promise<PgResult<T>> {
  const attempt = () => run({ unlockCode: generateUnlockCode(), qrToken: generateQrToken() })
  let result = await attempt()
  for (let i = 0; i < 2 && result.error?.code === UNIQUE_VIOLATION; i++) result = await attempt()
  return result
}

export function issueComplimentaryPass(
  supabase: ServiceClient,
  input: { productId: string; name: string; email: string; entries: number; expiresAt: string; actorId: string },
): Promise<PgResult<TicketPass>> {
  return withFreshCodes<TicketPass>(({ unlockCode, qrToken }) =>
    supabase.rpc('issue_complimentary_pass', {
      p_product_id: input.productId,
      p_name: input.name,
      p_email: input.email,
      p_entries: input.entries,
      p_expires_at: input.expiresAt,
      p_actor: input.actorId,
      p_unlock_code: unlockCode,
      p_qr_token: qrToken,
    }),
  )
}

/** Void passes are returned too, so the caller can say the pass is void. */
export async function findPass(
  supabase: ServiceClient,
  key: { code: string } | { qrToken: string },
): Promise<TicketPass | null> {
  const query = supabase.from('ticket_passes').select('*')
  const { data, error } = await ('code' in key
    ? query.eq('unlock_code', normalizeUnlockCode(key.code))
    : query.eq('qr_token', key.qrToken)
  ).maybeSingle()
  if (error) throw error
  return data
}

type ClerkEmail = { emailAddress: string; verification: { status: string } | null }

/** Lower-cased addresses Clerk has verified. An unverified address proves nothing. */
export function verifiedEmails(user: { emailAddresses: ClerkEmail[] }): string[] {
  return user.emailAddresses
    .filter((e) => e.verification?.status === 'verified')
    .map((e) => e.emailAddress.toLowerCase())
}

/**
 * Links the pass to the profile only when Clerk verified the pass's own email
 * for it. Never moves a pass another profile already holds.
 */
export async function linkPassToProfile(
  supabase: ServiceClient,
  pass: Pick<TicketPass, 'id' | 'holder_email'>,
  profileId: string,
  user: { emailAddresses: ClerkEmail[] },
): Promise<boolean> {
  if (!verifiedEmails(user).includes(pass.holder_email.toLowerCase())) return false
  const { data, error } = await supabase
    .from('ticket_passes')
    .update({ holder_profile_id: profileId })
    .eq('id', pass.id)
    .is('holder_profile_id', null)
    .select('id')
    .maybeSingle()
  if (error) throw error
  return data !== null
}
