import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isSafeSupabaseTarget } from '../../scripts/lib/safe-supabase-target'
import {
  E2E_STRIPE_WEBHOOK_SECRET, E2E_SYNC_SECRET, E2E_ZOOM_WEBHOOK_SECRET, FAKE_URL, FAKE_WEBINAR,
} from './config.mjs'

/**
 * Environment of the dev server Playwright starts. It outranks `.env*` files, so
 * real Zoom, Stripe and Resend keys are not used. Empty without a safe database:
 * the public projects also run on machines that have none.
 */
export function fakeEnv(): Record<string, string> {
  if (!isSafeSupabaseTarget(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')) return {}
  const preload = pathToFileURL(path.join(__dirname, 'preload.mjs')).href
  return {
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${preload}`.trim(),
    NEXT_PUBLIC_APP_URL: 'http://localhost:3400',
    ZOOM_ACCOUNT_ID: 'e2e',
    ZOOM_CLIENT_ID: 'e2e',
    ZOOM_CLIENT_SECRET: 'e2e',
    ZOOM_WEBHOOK_SECRET_TOKEN: E2E_ZOOM_WEBHOOK_SECRET,
    ZOOM_ALLOWED_EVENT_IDS: FAKE_WEBINAR,
    RESEND_API_KEY: 're_e2e',
    RESEND_BASE_URL: FAKE_URL,
    STRIPE_SECRET_KEY: 'sk_test_e2e',
    STRIPE_WEBHOOK_SECRET: E2E_STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_e2e',
    SYNC_SECRET: E2E_SYNC_SECRET,
  }
}
