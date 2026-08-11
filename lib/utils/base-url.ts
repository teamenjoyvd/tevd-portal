/** Trim, strip trailing slashes, and treat a blank result as "not configured". */
function normalizeHost(raw: string | undefined): string | null {
  const normalized = raw?.trim().replace(/\/+$/, '')
  if (normalized === undefined || normalized === '') return null
  return normalized
}

/**
 * Resolve the app's public base URL, without a trailing slash.
 *
 * Prefers `NEXT_PUBLIC_APP_URL` (set in every deployed environment). Never
 * falls back to the incoming request's `Host` header, which is
 * attacker-controlled and must never be trusted for externally-visible links
 * (email `actionUrl`, ICS feed subscription URL, magic links).
 *
 * Vercel's `VERCEL_BRANCH_URL` / `VERCEL_URL` are a safe fallback because the
 * platform injects them into the runtime — they are not derived from the
 * request — so they carry none of the `Host` spoofing risk (2608-DEV-713).
 * The fallback is scoped to non-production deployments on purpose: production
 * has `NEXT_PUBLIC_APP_URL`, and a `*.vercel.app` magic link in a member's
 * inbox is unbranded and phishing-shaped, so a production misconfiguration
 * should stay loud rather than silently ship an off-domain link.
 */
export async function getBaseUrl(): Promise<string> {
  const configured = normalizeHost(process.env.NEXT_PUBLIC_APP_URL)
  if (configured !== null) return configured

  // Positive allowlist rather than `!== 'production'`: an unset or unknown
  // VERCEL_ENV must NOT enable the fallback.
  const vercelEnv = process.env.VERCEL_ENV
  const isNonProductionVercelDeploy = vercelEnv === 'preview' || vercelEnv === 'development'
  if (isNonProductionVercelDeploy) {
    // Both are bare hostnames with no scheme. Branch URL first: it is stable
    // across redeploys, so a magic link already sitting in an inbox still
    // resolves after the next preview build, which the per-deployment
    // VERCEL_URL would not guarantee.
    const host = normalizeHost(process.env.VERCEL_BRANCH_URL) ?? normalizeHost(process.env.VERCEL_URL)
    if (host !== null) return `https://${host}`
  }

  throw new Error(
    'NEXT_PUBLIC_APP_URL is not set. Set it in .env.local to build absolute links locally.'
  )
}
