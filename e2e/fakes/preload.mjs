/**
 * Loaded into the E2E dev server with NODE_OPTIONS=--import. Sends Zoom calls to
 * the fake server, so no production code knows about tests (2611-DEV-803).
 */
import { createRequire } from 'node:module'
import { FAKE_URL } from './config.mjs'

const { isSafeSupabaseTarget } = createRequire(import.meta.url)('../../scripts/lib/safe-supabase-target.js')
if (process.env.VERCEL_ENV !== undefined || !isSafeSupabaseTarget(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')) {
  throw new Error('e2e preload: only for a local dev server on local or DEV Supabase')
}

const ZOOM_HOSTS = ['zoom.us', 'api.zoom.us']
const realFetch = globalThis.fetch
globalThis.fetch = function (input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (!ZOOM_HOSTS.includes(url.hostname)) return realFetch.call(this, input, init)
  const target = `${FAKE_URL}/zoom${url.pathname}${url.search}`
  return realFetch.call(this, input instanceof Request ? new Request(target, input) : target, init)
}
