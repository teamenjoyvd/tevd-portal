import type { SupabaseClient } from '@supabase/supabase-js'

const STORAGE_URL_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/social-thumbnails/`

const CDN_PATTERNS = [
  /\.fbcdn\.net\//,
  /\.cdninstagram\.com\//,
]

export function isCdnUrl(url: string): boolean {
  return CDN_PATTERNS.some(p => p.test(url))
}

export function isStorageUrl(url: string): boolean {
  return url.startsWith(STORAGE_URL_PREFIX)
}

/**
 * Downloads `url` server-side and uploads to the `social-thumbnails` Storage bucket.
 * - No-ops (returns `url`) if already a Storage URL.
 * - Returns `null` on any failure — callers treat this as non-fatal and fall back to original.
 */
export async function mirrorToStorage(
  url: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  if (!url) return null
  if (isStorageUrl(url)) return url

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null

    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const ext = contentType.includes('png') ? 'png'
      : contentType.includes('webp') ? 'webp'
      : contentType.includes('gif') ? 'gif'
      : 'jpg'

    const buffer = await res.arrayBuffer()
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabase.storage
      .from('social-thumbnails')
      .upload(filename, buffer, { contentType, upsert: false })

    if (error) return null

    return `${STORAGE_URL_PREFIX}${filename}`
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
