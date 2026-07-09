// server-only — do not import from client components
import 'server-only'

export type OgScrapeResult = {
  thumbnail_url: string | null
  caption: string | null
}

/** Extract charset label from a Content-Type header value, e.g. "text/html; charset=windows-1251" */
function charsetFromContentType(contentType: string | null): string | null {
  if (!contentType) return null
  const m = contentType.match(/charset=([^\s;]+)/i)
  return m ? m[1].trim() : null
}

/** Extract charset from raw HTML bytes decoded as latin-1 (safe for ASCII-range meta tags) */
function charsetFromHtmlMeta(raw: string): string | null {
  // <meta charset="windows-1251">
  const m1 = raw.match(/<meta[^>]+charset=[\"']?([^\"'\s;>]+)/i)
  if (m1) return m1[1].trim()
  // <meta http-equiv="Content-Type" content="text/html; charset=windows-1251">
  const m2 = raw.match(/charset=([^\s;\"']+)/i)
  return m2 ? m2[1].trim() : null
}

/** Decode HTML entities in an attribute value extracted via regex. */
function decodeEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/** Reject non-http(s) schemes and obvious private/internal/loopback/link-local hosts (SSRF guard). */
function isBlockedTarget(rawUrl: string): boolean {
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

  // IPv6 loopback / link-local / unique-local
  if (hostname === '::1' || hostname.startsWith('fe80:') || hostname.startsWith('fc') || hostname.startsWith('fd')) return true

  return false
}

export async function scrapeOgTags(url: string): Promise<OgScrapeResult> {
  if (isBlockedTarget(url)) {
    console.error(`[og-scrape] Blocked disallowed target ${url}`)
    return { thumbnail_url: null, caption: null }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; tevd-portal/1.0)' },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[og-scrape] HTTP ${res.status} for ${url}`)
      return { thumbnail_url: null, caption: null }
    }

    // Detect charset — header first, then meta tags in raw bytes
    const buffer = await res.arrayBuffer()
    const ctCharset = charsetFromContentType(res.headers.get('content-type'))

    let charset = ctCharset ?? 'utf-8'

    if (!ctCharset) {
      // Decode a leading slice as latin-1 to safely read ASCII-range meta tags
      const probe = new TextDecoder('latin-1').decode(buffer.slice(0, 4096))
      charset = charsetFromHtmlMeta(probe) ?? 'utf-8'
    }

    let html: string
    try {
      html = new TextDecoder(charset).decode(buffer)
    } catch {
      // Unknown charset label — fall back to UTF-8
      html = new TextDecoder('utf-8').decode(buffer)
    }

    const ogImage = html.match(/<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']/i)
      ?? html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:image[\"']/i)

    const ogDesc = html.match(/<meta[^>]+property=[\"']og:description[\"'][^>]+content=[\"']([^\"']+)[\"']/i)
      ?? html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:description[\"']/i)

    return {
      thumbnail_url: ogImage?.[1] != null ? decodeEntities(ogImage[1]) : null,
      caption:       ogDesc?.[1]  != null ? decodeEntities(ogDesc[1])  : null,
    }
  } catch (err) {
    console.error('[og-scrape] Failed to scrape', url, err)
    return { thumbnail_url: null, caption: null }
  }
}
