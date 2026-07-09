// Pure functions only — no 'server-only' pragma. Imported by lib/social-thumbnail.ts,
// which is in turn imported by client components (SocialPostForm.tsx) for isCdnUrl/isStorageUrl.

/** Reject non-http(s) schemes and obvious private/internal/loopback/link-local hosts (SSRF guard). */
export function isBlockedTarget(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return true
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true

  const hostname = parsed.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true

  // IPv4 literal — block loopback, private, link-local (incl. cloud metadata 169.254.169.254), and unspecified ranges
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    if (a === 127 || a === 10 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }

  // URL.hostname returns bracketed IPv6 literals, e.g. "[::1]", "[fc00::1]" — unwrap before checking.
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const v6 = hostname.slice(1, -1)
    const firstHextet = v6.split(':')[0]
    if (v6 === '::1' || v6 === '::' || firstHextet.startsWith('fe80') || /^f[cd]/.test(firstHextet)) return true
    return false
  }

  return false
}

/** fetch() that manually follows redirects, re-validating each hop against isBlockedTarget (prevents SSRF via redirect). */
export async function safeFetch(url: string, init: RequestInit, maxRedirects = 5): Promise<Response> {
  let currentUrl = url
  for (let i = 0; i <= maxRedirects; i++) {
    if (isBlockedTarget(currentUrl)) throw new Error(`Blocked target: ${currentUrl}`)

    const res = await fetch(currentUrl, { ...init, redirect: 'manual' })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return res
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }
    return res
  }
  throw new Error(`Too many redirects fetching ${url}`)
}
