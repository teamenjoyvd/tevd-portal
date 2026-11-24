import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto'
import type { createServiceClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof createServiceClient>

export const CODE_TTL_MS = 10 * 60_000

const hash = (text: string) => createHash('sha256').update(text).digest('hex')

export const newDeviceToken = () => randomBytes(32).toString('base64url')

/** The cookie holds a random token; only its hash is stored, so a forged cookie matches nothing. */
export function holdsDevice(tokenHash: string | null, token: string | undefined): boolean {
  if (tokenHash === null || token === undefined) return false
  const a = Buffer.from(tokenHash)
  const b = Buffer.from(hash(token))
  return a.length === b.length && timingSafeEqual(a, b)
}

/** First device wins: only an unclaimed admission can be claimed without a one-time code. */
export async function claimFirstDevice(supabase: ServiceClient, admissionId: string): Promise<string | null> {
  const token = newDeviceToken()
  const { data, error } = await supabase
    .from('ticket_admissions')
    .update({ device_token_hash: hash(token), device_claimed_at: new Date().toISOString() })
    .eq('id', admissionId)
    .is('device_token_hash', null)
    .in('status', ['pending_zoom', 'active'])
    .select('id')
    .maybeSingle()
  if (error) throw error
  return data === null ? null : token
}

/** A new code replaces the previous one. */
export async function createDeviceCode(supabase: ServiceClient, admissionId: string): Promise<string> {
  const code = String(randomInt(1_000_000)).padStart(6, '0')
  const { error } = await supabase.from('ticket_device_codes').upsert({
    admission_id: admissionId,
    code_hash: hash(`${admissionId}:${code}`),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  })
  if (error) throw error
  return code
}

/** Deleting the row is what uses the code, so it works once. Returns the new device's token. */
export async function moveDevice(supabase: ServiceClient, admissionId: string, code: string): Promise<string | null> {
  const { data: used, error } = await supabase
    .from('ticket_device_codes')
    .delete()
    .eq('admission_id', admissionId)
    .eq('code_hash', hash(`${admissionId}:${code.trim()}`))
    .gt('expires_at', new Date().toISOString())
    .select('admission_id')
    .maybeSingle()
  if (error) throw error
  if (used === null) return null

  const token = newDeviceToken()
  const { data, error: moveError } = await supabase
    .from('ticket_admissions')
    .update({ device_token_hash: hash(token), device_claimed_at: new Date().toISOString() })
    .eq('id', admissionId)
    .in('status', ['pending_zoom', 'active'])
    .select('id')
    .maybeSingle()
  if (moveError) throw moveError
  return data === null ? null : token
}
