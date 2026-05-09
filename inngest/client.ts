import { Inngest } from 'inngest'

/**
 * Shared Inngest client.
 * INNGEST_EVENT_KEY is used by inngest.send() to authenticate event ingestion.
 * INNGEST_SIGNING_KEY is used by the serve handler to verify incoming job callbacks.
 * Both must be set in Vercel environment before deployment.
 */
export const inngest = new Inngest({ id: 'tevd-portal' })
