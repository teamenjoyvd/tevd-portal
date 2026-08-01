/**
 * Shared write-target guard for the seed scripts.
 *
 * Every seed script holds a SUPABASE_SERVICE_ROLE_KEY and must refuse to run
 * against anything but a local instance or the hosted DEV project. Each script
 * used to carry its own copy of this check, and the copies drifted: two
 * independent CodeRabbit findings on PR 687 hardened seed-smoke-calendar.js
 * alone while three siblings kept the original weaknesses. One definition, one
 * place to harden.
 *
 * Two properties the substring version (`url.includes(DEV_PROJECT_REF)`) lacked:
 *
 *   1. The ref must match the HOST, not merely appear somewhere in the string.
 *      A substring test passes for `https://evil.example/?ref=<ref>` and for
 *      `https://<ref>.supabase.co.evil.example`, either of which would send the
 *      service-role key to a host that is not Supabase.
 *   2. The hosted target must be HTTPS. `http://<ref>.supabase.co` would put
 *      that key on the wire in cleartext. Plaintext is for localhost only,
 *      where `supabase start` serves it.
 */

const DEV_PROJECT_REF = 'iymwxdewcpvpjgzewtzk'

function isSafeSupabaseTarget(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  }
  return parsed.protocol === 'https:' && parsed.hostname === `${DEV_PROJECT_REF}.supabase.co`
}

module.exports = {
  DEV_PROJECT_REF,
  isSafeSupabaseTarget,
}
