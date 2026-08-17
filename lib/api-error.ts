/**
 * The error both client fetch wrappers throw on a non-ok response.
 *
 * It lives here rather than in `lib/apiClient.ts` — where it was defined until
 * 2608-DEV-751 — so that `lib/utils/fetchJson.ts` can throw it too. `apiClient`
 * imports `getToken` from `@clerk/nextjs` and carries module-level 401-redirect
 * state; `fetchJson` is deliberately minimal, and importing `apiClient` just to
 * reach this class would pull all of that into every `fetchJson` call site.
 *
 * Only the class moved. The two wrappers keep their own body parsing on
 * purpose: `apiClient` falls back to `json.message` and `fetchJson` does not,
 * and collapsing that difference would change `fetchJson`'s message for every
 * caller.
 *
 * `lib/apiClient.ts` re-exports this, so `import { ApiError } from '@/lib/apiClient'`
 * keeps working.
 */
export class ApiError extends Error {
  /**
   * `code` is the machine-readable failure discriminant a route may send
   * alongside its error string (2608-DEV-733), e.g. `event_full` from
   * `/api/events/[id]/attend`. Optional because most routes send only a
   * message; a client that needs to branch should switch on this and never on
   * `message`, which is English developer copy and free to be reworded.
   */
  constructor(public status: number, message: string, public code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}
