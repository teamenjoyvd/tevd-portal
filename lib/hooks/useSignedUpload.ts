'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * React hook for signed-URL uploads.
 *
 * Sequence:
 *   GET  urlEndpoint?filename=X  → { signedUrl, path }
 *   PUT  signedUrl (raw bytes)   → storage
 *   POST urlEndpoint/confirm     → { url }
 *   resolves { path, url }
 *
 * Intentionally does NOT delegate to uploadToSignedUrl — that util discards
 * `path` and returns only `url`. This hook needs both.
 *
 * uploadToSignedUrl remains the interface for surfaces that don't need path
 * (Tiptap ImageUploadExtension, CoverImageUploader).
 */
export function useSignedUpload(urlEndpoint: string): {
  upload: (file: File) => Promise<{ path: string; url: string }>
  uploading: boolean
  error: string | null
} {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const uploadingRef = useRef(false)

  const upload = useCallback(
    async (file: File): Promise<{ path: string; url: string }> => {
      if (uploadingRef.current) {
        return Promise.reject(new Error('Upload already in progress'))
      }

      uploadingRef.current = true
      setUploading(true)
      setError(null)

      try {
        // Step 1: get signed upload URL
        const urlRes = await fetch(
          `${urlEndpoint}?filename=${encodeURIComponent(file.name)}`
        )
        if (!urlRes.ok) {
          const e = await urlRes.json().catch(() => ({}))
          throw new Error((e as { error?: string }).error ?? 'Failed to get upload URL')
        }
        const { signedUrl, path } = (await urlRes.json()) as {
          signedUrl: string
          path: string
        }

        // Step 2: PUT file bytes directly to storage
        const putRes = await fetch(signedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        })
        if (!putRes.ok) throw new Error('Storage upload failed')

        // Step 3: confirm and get public URL
        const confirmRes = await fetch(`${urlEndpoint}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path,
            filename: file.name,
            fileType: file.type,
          }),
        })
        if (!confirmRes.ok) {
          const e = await confirmRes.json().catch(() => ({}))
          throw new Error((e as { error?: string }).error ?? 'Failed to confirm upload')
        }
        const { url } = (await confirmRes.json()) as { url: string }
        if (!url) throw new Error('No URL returned from confirm')

        return { path, url }
      } catch (err) {
        const msg = (err as Error).message ?? 'Upload failed'
        setError(msg)
        throw err
      } finally {
        uploadingRef.current = false
        setUploading(false)
      }
    },
    [urlEndpoint]
  )

  return { upload, uploading, error }
}
