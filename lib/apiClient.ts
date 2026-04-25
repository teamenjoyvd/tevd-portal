/**
 * Shared fetch wrapper for client-side API calls.
 *
 * Provides:
 * - TypeScript generics (no `any` returns)
 * - `response.ok` check (fetch does not throw on 4xx/5xx)
 * - 401 interception (redirects to sign-in)
 * - Baseline `Content-Type: application/json` header
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
  if (!headers.has('Content-Type')) {
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
    const body = await response.text().catch(() => '')
    throw new ApiError(response.status, body || `API Error: ${response.status}`)
  }

  return response.json() as Promise<T>
}
