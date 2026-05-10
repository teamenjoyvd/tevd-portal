import { Inngest } from 'inngest'

/**
 * Shared Inngest client.
 * INNGEST_EVENT_KEY is used by inngest.send() to authenticate event ingestion.
 * INNGEST_SIGNING_KEY is used by the serve handler to verify incoming job callbacks.
 * Both must be set in Vercel environment before deployment.
 *
 * v4: configuration is resolved lazily at first use — no eager decodeURIComponent
 * at module construction time. The build-time-placeholder fallback is no longer needed.
 */
export const inngest = new Inngest({
  id: 'tevd-portal',
})
