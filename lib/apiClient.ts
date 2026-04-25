/**
 * Shared fetch wrapper for client-side API calls.
 *
 * Provides:
 * - TypeScript generics (no `any` returns)
 * - `response.ok` check (fetch does not throw on 4xx/5xx)
 * - 401 interception (redirects to sign-in)
 * - `Content-Type: application/json` header (skipped for FormData or bodyless requests)
 *
 * Client-only — do NOT import in RSC pages, route handlers, or server actions.
 */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiClient<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  if (!headers.has('Content-Type') && options?.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    if (response.status === 401) {
      // Session expired — redirect to sign-in
      if (typeof window !== 'undefined') {
        window.location.href = '/sign-in'
      }
      throw new ApiError(401, 'Unauthorized')
    }
    const text = await response.text().catch(() => '')
    let message = `API Error: ${response.status}`
    if (text) {
      try {
        const json = JSON.parse(text)
        message = json?.error ?? json?.message ?? text
      } catch {
        message = text
      }
    }
    throw new ApiError(response.status, message)
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : {}) as T
}
