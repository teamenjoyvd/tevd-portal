// Pure functions only — no 'server-only' pragma. Imported by lib/social-thumbnail.ts,
// which is in turn imported by client components (SocialPostForm.tsx) for isCdnUrl/isStorageUrl.

/** Loopback, private, link-local (incl. cloud metadata 169.254.169.254), and unspecified IPv4 ranges. */
function isBlockedIpv4(a: number, b: number): boolean {
  if (a === 127 || a === 10 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

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

  // IPv4 literal (the WHATWG URL parser normalizes decimal/hex/octal/short forms to dotted-decimal)
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) return isBlockedIpv4(Number(ipv4[1]), Number(ipv4[2]))

  // URL.hostname returns bracketed IPv6 literals, e.g. "[::1]", "[fc00::1]" — unwrap before checking.
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const v6 = hostname.slice(1, -1)
    if (v6 === '::1' || v6 === '::') return true

    // IPv4-mapped/-compatible IPv6 ("::ffff:7f00:1" / "::7f00:1") — decode the embedded IPv4 and re-check.
    const mapped = v6.match(/^::(?:ffff:)?([0-9a-f]{1,4}):[0-9a-f]{1,4}$/)
    if (mapped) {
      // mapped[1] holds the high 16 bits of the embedded IPv4 (its first two octets) — sufficient
      // since every blocklist range below is keyed off octets A/B only.
      const hi = parseInt(mapped[1], 16)
      const a = (hi >> 8) & 0xff
      const b = hi & 0xff
      if (isBlockedIpv4(a, b)) return true
    }

    // fc00::/7 (unique local) and fe80::/10 (link-local) — check the numeric value of the first hextet.
    const firstHextet = parseInt(v6.split(':')[0] || '0', 16) || 0
    if (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) return true
    if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) return true

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
