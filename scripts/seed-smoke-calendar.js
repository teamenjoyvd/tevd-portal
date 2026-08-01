#!/usr/bin/env node

/**
 * Seeds one stable, guest-visible calendar event in the CURRENT Sofia month
 * (plus the next one) for the preview-smoke calendar flow
 * (e2e/calendar.spec.ts): guest opens /calendar, clicks the first event pill
 * in the month grid, and gets the event popup.
 *
 * Why the next month too: the spec derives "current month" from the Sofia
 * calendar day (app/(dashboard)/calendar/page.tsx), which rolls over at
 * 21:00Z in summer / 22:00Z in winter. Seeding both months removes the race
 * where the seed step and the test step straddle that boundary.
 *
 * Why this exists at all: on 2026-07-31T23:33Z the smoke failed with "no
 * calendar events found in the current month view" — DEV held 3 ad-hoc
 * events, all in 2026-07, and Sofia had just entered August. The spec is
 * deliberately written to fail loudly on an empty month rather than skip,
 * so the fixture has to renew itself instead.
 *
 * Idempotent: upserts on a deterministic per-month UUID, so re-running never
 * accumulates rows. Safe to run on every preview deployment.
 *
 * google_event_id is left NULL on purpose. The calendar-sync edge function
 * reconciles by that column (supabase/functions/sync-google-calendar/index.ts
 * :360-372) and deletes any row whose google_event_id is absent from the
 * Google feed; SQL `IN (NULL)` never matches, so a NULL-id fixture survives a
 * sync run. (The pre-existing 'e2e-multiday-span-test' row does not.)
 *
 * SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL points at a local
 * instance (127.0.0.1/localhost) or the hosted DEV project
 * (iymwxdewcpvpjgzewtzk) — this must never write to prod/preview Supabase.
 * (Mirrors scripts/seed-smoke-guide.js.)
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Plain `node` does not auto-load env files — mirrors scripts/seed-smoke-guide.js.
// Loaded in Next.js precedence order: .env.development.local first (higher
// priority — already-set vars are never overwritten), then .env.local.
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath) === false) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match === null) continue
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}

const root = process.cwd()
loadEnvFile(path.join(root, '.env.development.local'))
loadEnvFile(path.join(root, '.env.local'))

const DEV_PROJECT_REF = 'iymwxdewcpvpjgzewtzk'

// 'YYYY-MM-DD' of the Sofia calendar day (sv-SE gives ISO order).
// Same formatter contract as lib/calendar-dates.ts SOFIA_DATE_FMT, restated
// here because that module is TypeScript and this script runs under plain node.
const SOFIA_DATE_FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Sofia',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 'YYYY-MM' of the Sofia calendar month containing `date`. */
function sofiaMonthKey(date) {
  return SOFIA_DATE_FMT.format(date).slice(0, 7)
}

/**
 * 'YYYY-MM' one month later. Plain integer arithmetic on the month number —
 * no Date involved, so the day-31 overflow trap (Jan 31 + 1 month) cannot
 * apply here. Traces: 2026-08 -> 2026-09; 2026-12 -> 2027-01; 2026-01 -> 2026-02.
 */
function nextMonthKey(monthKey) {
  const year = Number(monthKey.slice(0, 4))
  const month = Number(monthKey.slice(5, 7))
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`
}

// Copied from app/(dashboard)/calendar/utils.ts:25 (TypeScript — not requirable
// from this CommonJS script). Covered there by utils.test.ts.
function isoWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const w1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)
}

/**
 * Deterministic UUID per month key, so the upsert replaces last run's row
 * instead of appending. 'e2e0ca1e' is hex-legal leetspeak for "e2e calendar";
 * the node segment carries YYYYMM (digits are valid hex) padded to 12 chars.
 */
function fixtureId(monthKey) {
  return `e2e0ca1e-0000-4000-8000-${monthKey.replace('-', '')}000000`
}

/**
 * Day 15 at 09:00-11:00 UTC. Deliberately mid-month and mid-day: Sofia is
 * UTC+2 (EET) or UTC+3 (EEST), so this lands at 11:00/12:00 Sofia on the 15th
 * under either offset and can never slip into an adjacent month. Range is
 * [start, end) in the same sense as the /calendar window query.
 */
function fixtureEvent(monthKey) {
  const startIso = `${monthKey}-15T09:00:00.000Z`
  return {
    id: fixtureId(monthKey),
    title: 'E2E Smoke Event',
    description: 'Fixture event for the preview-smoke calendar flow. Safe to leave in DEV.',
    start_time: startIso,
    end_time: `${monthKey}-15T11:00:00.000Z`,
    category: 'N21',
    event_type: 'in-person',
    week_number: isoWeek(new Date(startIso)),
    access_roles: ['admin', 'core', 'member', 'guest'],
    is_all_day: false,
    location: 'Sofia',
    google_event_id: null,
  }
}

function isSafeSupabaseTarget(url) {
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) return true
  return url.includes(DEV_PROJECT_REF)
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (isSafeSupabaseTarget(supabaseUrl) === false) {
    console.error(
      `seed-smoke-calendar: refusing to run — NEXT_PUBLIC_SUPABASE_URL ("${supabaseUrl}") ` +
        'is not a local instance or the hosted DEV project. This script must never write to prod/preview Supabase.',
    )
    process.exitCode = 1
    return
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey === undefined || serviceRoleKey === '') {
    console.error('seed-smoke-calendar: SUPABASE_SERVICE_ROLE_KEY is not set.')
    process.exitCode = 1
    return
  }

  const thisMonth = sofiaMonthKey(new Date())
  const months = [thisMonth, nextMonthKey(thisMonth)]
  const rows = months.map(fixtureEvent)

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { error } = await supabase
    .from('calendar_events')
    .upsert(rows, { onConflict: 'id' })
  if (error !== null) throw new Error(`calendar_events upsert failed for ${months.join(', ')}: ${error.message}`)
  console.log(`seed-smoke-calendar: ready — guest-visible event on the 15th of ${months.join(' and ')}`)
}

main().catch((err) => {
  console.error('seed-smoke-calendar: failed —', err)
  process.exitCode = 1
})
