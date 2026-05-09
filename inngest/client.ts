import { Inngest } from 'inngest'

/**
 * Shared Inngest client.
 * INNGEST_EVENT_KEY is used by inngest.send() to authenticate event ingestion.
 * INNGEST_SIGNING_KEY is used by the serve handler to verify incoming job callbacks.
 * Both must be set in Vercel environment before deployment.
 *
 * The client is constructed with an explicit empty-string fallback for
 * INNGEST_SIGNING_KEY so that decodeURIComponent does not throw a URIError
 * during Next.js build-time page data collection (the env var is absent at
 * build time and only available at runtime on Vercel).
 */
export const inngest = new Inngest({
  id: 'tevd-portal',
  eventKey: process.env.INNGEST_EVENT_KEY ?? 'build-time-placeholder',
})
