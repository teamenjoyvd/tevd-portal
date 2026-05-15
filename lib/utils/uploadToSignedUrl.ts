/**
 * Shared signed-URL upload utility.
 * Sequence: GET urlEndpoint?filename=X → { signedUrl, path } →
 *           PUT file to signedUrl (raw bytes, no JSON) →
 *           POST confirmEndpoint with { path } → { url }
 *
 * Returns the final public URL. Throws on any failure.
 * No React state — callers manage their own loading state.
 */
export async function uploadToSignedUrl(
  file: File,
  urlEndpoint: string,
  confirmEndpoint: string,
): Promise<string> {
  // Step 1: get signed upload URL
  const urlRes = await fetch(
    `${urlEndpoint}?filename=${encodeURIComponent(file.name)}`,
  )
  if (!urlRes.ok) {
    const err = await urlRes.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to get upload URL')
  }
  const { signedUrl, path } = await urlRes.json() as { signedUrl: string; path: string }

  // Step 2: PUT file bytes directly to storage — server never touches the bytes
  const putRes = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  if (!putRes.ok) throw new Error('Storage upload failed')

  // Step 3: confirm and get public URL
  const confirmRes = await fetch(confirmEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!confirmRes.ok) {
    const err = await confirmRes.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to confirm upload')
  }
  const { url } = await confirmRes.json() as { url: string }
  if (!url) throw new Error('No URL returned from confirm')

  return url
}
