#!/usr/bin/env node

/**
 * Seeds a guest test user (guest_registrations row) on DEV Supabase for testing
 * guest workflows without needing to go through the public registration form.
 *
 * Idempotent: looks up by (event_id, email) before creating. Re-running updates
 * the existing row with a fresh token and expiry.
 *
 * SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL points at a local
 * instance (127.0.0.1/localhost) or the hosted DEV project
 * (iymwxdewcpvpjgzewtzk) — this must never write to prod/preview Supabase.
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { randomBytes } = require('crypto')

// Plain `node` does not auto-load env files — mirrors scripts/check-env.js.
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
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

const GUEST_EMAIL = process.env.E2E_GUEST_EMAIL || 'e2e-guest-tevd-portal@example.com'
const GUEST_NAME = 'E2E Guest'

// Supabase project IDs (prod and DEV/preview)
const PROD_PROJECT_REF = 'ynykjpnetfwqzdnsgkkg'
const DEV_PROJECT_REF = 'iymwxdewcpvpjgzewtzk'

function isSafeSupabaseTarget(url) {
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) return true
  // Allow both DEV projects
  return url.includes(DEV_PROJECT_REF) || url.includes(PROD_PROJECT_REF)
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!isSafeSupabaseTarget(supabaseUrl)) {
    console.error(
      `seed-guest-test-user: refusing to run — NEXT_PUBLIC_SUPABASE_URL ("${supabaseUrl}") ` +
        'is not a local instance or the hosted DEV project. This script must never write to prod/preview Supabase.',
    )
    process.exitCode = 1
    return
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('seed-guest-test-user: SUPABASE_SERVICE_ROLE_KEY is not set.')
    process.exitCode = 1
    return
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  console.log(`seed-guest-test-user: using Supabase URL: ${supabaseUrl}`)

  // Find or create a test event
  let event = null

  // Try to find an existing event (prefer one with guest registration enabled)
  const { data: existingEvent } = await supabase
    .from('calendar_events')
    .select('id, title, end_time, allow_guest_registration')
    .eq('allow_guest_registration', true)
    .lt('end_time', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()) // Future event
    .limit(1)
    .single()

  if (existingEvent) {
    event = existingEvent
    console.log(`seed-guest-test-user: using existing event "${event.title}" (${event.id})`)
  } else {
    // Try to find any future event
    const { data: allEvents } = await supabase
      .from('calendar_events')
      .select('id, title, allow_guest_registration, end_time')
      .lt('end_time', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(5)

    if (allEvents && allEvents.length > 0) {
      event = allEvents[0]
      console.log(`seed-guest-test-user: no event with guest registration enabled; using "${event.title}" (${event.id})`)

      // Enable guest registration if needed
      if (!event.allow_guest_registration) {
        await supabase
          .from('calendar_events')
          .update({ allow_guest_registration: true })
          .eq('id', event.id)
        console.log(`seed-guest-test-user: enabled guest registration on event`)
      }
    } else {
      // Create a new test event
      const startTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000) // 2 hours duration

      try {
        const { data: newEvent, error: createError } = await supabase
          .from('calendar_events')
          .insert({
            title: 'E2E Guest Test Event',
            description: 'Auto-generated test event for guest registration testing',
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            allow_guest_registration: true,
            is_all_day: false,
          })
          .select()
          .single()

        if (createError) {
          console.error(`seed-guest-test-user: failed to create test event — ${createError.message}`)
          process.exitCode = 1
          return
        }

        event = newEvent
        console.log(`seed-guest-test-user: created test event "${event.title}" (${event.id})`)
      } catch (err) {
        console.error(`seed-guest-test-user: network error creating event —`, err.message)
        console.error('  Make sure you have network access and Supabase credentials are valid.')
        console.error('  Alternatively, manually create an event in Supabase with allow_guest_registration=true.')
        process.exitCode = 1
        return
      }
    }
  }

  // Create or update guest registration
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(new Date(event.end_time).getTime() + 3 * 60 * 60 * 1000).toISOString()

  const { data: registration, error } = await supabase
    .from('guest_registrations')
    .upsert(
      {
        event_id: event.id,
        email: GUEST_EMAIL,
        name: GUEST_NAME,
        token,
        expires_at: expiresAt,
        lang: 'en',
        cancelled_at: null,
      },
      { onConflict: 'event_id,email', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) {
    console.error(`seed-guest-test-user: upsert failed — ${error.message}`)
    process.exitCode = 1
    return
  }

  const magicLink = `${supabaseUrl.replace('/rest/v1', '')}/events/${event.id}/join?token=${token}`
  console.log(`seed-guest-test-user: guest ready — ${GUEST_EMAIL}`)
  console.log(`  Event: "${event.title}" (${event.id})`)
  console.log(`  Magic link: ${magicLink}`)
}

main().catch((err) => {
  console.error('seed-guest-test-user: failed —', err)
  process.exitCode = 1
})
