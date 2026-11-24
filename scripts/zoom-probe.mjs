#!/usr/bin/env node
/**
 * Zoom webinar-registrant probe (2611-DEV-773). Evidence for the ADR in
 * docs/architecture/DECISIONS.md. Not wired into CI or `npm test`.
 *
 *   ZOOM_PROBE_EVENT_ID=<webinar id> node --env-file=.env.development.local scripts/zoom-probe.mjs
 *
 * Touches ONE webinar, which must be a recurring one whose topic starts with
 * "TEST". It changes that webinar's registration settings and restores them,
 * and deletes every registration it creates (matched by this run's unique
 * email prefix, so registrations it did not create are never touched).
 *
 * Output is an allowlist: statuses, error messages, counts and short hashes.
 * No keys, tokens, join links, passcodes or host details are printed.
 */
import { createHash, randomBytes } from 'node:crypto'

const need = (name) => {
  const value = process.env[name]
  if (!value) {
    console.error(`zoom-probe: ${name} is not set; refusing to run.`)
    process.exit(1)
  }
  return value
}
const EVENT = need('ZOOM_PROBE_EVENT_ID').replace(/\s/g, '')
if (!/^\d{9,12}$/.test(EVENT)) {
  console.error('zoom-probe: ZOOM_PROBE_EVENT_ID must be a numeric webinar id.')
  process.exit(1)
}
const ACCOUNT = need('ZOOM_ACCOUNT_ID')
const CLIENT = need('ZOOM_CLIENT_ID')
const SECRET = need('ZOOM_CLIENT_SECRET')

const RUN = `tevd-probe-${randomBytes(4).toString('hex')}`
const email = (who) => `${RUN}-${who}@example.com`
const hash = (value) => (value ? createHash('sha256').update(value).digest('hex').slice(0, 8) : null)
const log = (label, data) => console.log(`${label}: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const tokenRes = await fetch(
  `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ACCOUNT)}`,
  {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${CLIENT}:${SECRET}`).toString('base64')}` },
    signal: AbortSignal.timeout(20_000),
  },
)
const { access_token: token } = await tokenRes.json()
if (!token) {
  console.error(`zoom-probe: token request failed (${tokenRes.status}).`)
  process.exit(1)
}

/** Every call is confined to the probe webinar: `path` is relative to it. */
async function zoom(method, path = '', body) {
  const res = await fetch(`https://api.zoom.us/v2/webinars/${EVENT}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  })
  await sleep(250)
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers }
}

const links = {}
async function register(label, who, { first = 'Probe', last = who, occ, extra } = {}) {
  const query = occ ? `?occurrence_ids=${occ}` : ''
  const { status, body, headers } = await zoom('POST', `/registrants${query}`, {
    email: email(who),
    first_name: first,
    last_name: last,
    ...extra,
  })
  links[label] = body?.join_url
  log(label, {
    status,
    code: body?.code,
    message: body?.message,
    fields: body && Object.keys(body),
    registrant: hash(body?.registrant_id),
    link: hash(body?.join_url),
    occurrences: body?.occurrences?.map((o) => o.occurrence_id),
    retryAfter: headers.get('retry-after') ?? undefined,
  })
  return body
}

async function listMine(occ) {
  const mine = []
  for (const status of ['approved', 'pending', 'denied']) {
    let page = ''
    do {
      const query = new URLSearchParams({ status, page_size: '300' })
      if (occ) query.set('occurrence_id', occ)
      if (page) query.set('next_page_token', page)
      const res = await zoom('GET', `/registrants?${query}`)
      if (res.status !== 200) throw new Error(`list registrants failed: ${res.status} ${res.body?.message ?? ''}`)
      mine.push(...res.body.registrants.filter((r) => r.email.startsWith(RUN)))
      page = res.body.next_page_token
    } while (page)
  }
  return mine
}
const show = (rows) =>
  rows.map((r) => ({
    who: r.email.slice(RUN.length + 1).split('@')[0],
    name: `${r.first_name} ${r.last_name}`,
    status: r.status,
    registrant: hash(r.id),
    link: hash(r.join_url),
    comments: r.comments || undefined,
  }))

const SETTINGS = [
  'registration_type',
  'approval_type',
  'registrants_confirmation_email',
  'registrants_email_notification',
  'allow_multiple_devices',
  'show_share_button',
  'meeting_authentication',
]
const pick = (settings) => Object.fromEntries(SETTINGS.map((key) => [key, settings[key]]))
async function setSettings(label, settings) {
  const res = await zoom('PATCH', '', { settings })
  const now = await zoom('GET')
  log(label, { status: res.status, message: res.body?.message, readBack: pick(now.body.settings) })
}

const event = await zoom('GET')
if (event.status !== 200) {
  console.error(`zoom-probe: cannot read the webinar (${event.status}): ${event.body?.message}`)
  process.exit(1)
}
if (!/^TEST\b/.test(event.body.topic) || event.body.type !== 9) {
  console.error('zoom-probe: not a recurring webinar with a topic starting "TEST"; refusing to run.')
  process.exit(1)
}
const original = pick(event.body.settings)
const [occ1, occ2, occ3, occ4] = event.body.occurrences
  .filter((o) => o.status === 'available' && Date.parse(o.start_time) > Date.now())
  .map((o) => o.occurrence_id)
if (!occ4) {
  console.error('zoom-probe: needs four future sessions; refusing to run.')
  process.exit(1)
}
log('original settings', original)
log('sessions', { total: event.body.occurrences.length, occ1, occ2 })

async function cleanup() {
  const everywhere = [undefined, occ1, occ2, occ3, occ4]
  let found = 0
  const failed = []
  for (const occ of everywhere) {
    for (const r of await listMine(occ)) {
      found++
      const res = await zoom('DELETE', `/registrants/${r.id}${occ ? `?occurrence_id=${occ}` : ''}`)
      if (res.status !== 204) failed.push({ status: res.status, code: res.body?.code, was: r.status })
    }
  }
  const left = []
  for (const occ of everywhere) left.push(...(await listMine(occ)))
  log('cleanup', { found, failed, left: left.length })
  if (left.length > 0) process.exitCode = 1
}

try {
  await setSettings('Q6 emails off', {
    registrants_confirmation_email: false,
    registrants_email_notification: false,
  })
  await setSettings('Q4 single device', { allow_multiple_devices: false, show_share_button: false })

  for (const type of [1, 2, 3]) {
    await setSettings(`Q1 registration_type ${type}`, { registration_type: type })
    await register(`Q1 type ${type}, session 1 only`, `t${type}`, { occ: occ1 })
    const who = (rows) => rows.filter((r) => r.email === email(`t${type}`)).length
    log(`Q1 type ${type} listed in`, { occ1: who(await listMine(occ1)), occ2: who(await listMine(occ2)) })
  }

  // Runs last of the type changes: registrations made under 3, then type 1, then back.
  await setSettings('Wipe test: type 3 -> 1', { registration_type: 1 })
  log('Wipe test: listed under 1', (await listMine(occ1)).length)
  await setSettings('Wipe test: 1 -> 3', { registration_type: 3 })
  log('Wipe test: listed back under 3', (await listMine(occ1)).length)

  await setSettings('settle on type 2', { registration_type: 2 })
  const hit = await register('Q2 A session 1', 'a', { occ: occ1, extra: { comments: 'our-id-123' } })
  const one = await zoom('GET', `/registrants/${hit?.registrant_id}?occurrence_id=${occ1}`)
  log('Q8 our id read back', { status: one.status, comments: one.body?.comments, message: one.body?.message })
  await register('Q2 B session 1', 'b', { occ: occ1 })
  await register('Q2/Q8 A session 1 again', 'a', { occ: occ1 })
  await register('Q2 A session 2', 'a', { occ: occ2 })
  await register('Q2 no session given', 'nosession')
  log('Q2/Q8 listed, session 1', show(await listMine(occ1)))
  log('Q2 listed, session 2', show(await listMine(occ2)))

  await register('Q9 rename: register', 'r', { last: 'Before', occ: occ1 })
  await register('Q9 rename: re-register', 'r', { last: 'After', occ: occ1 })
  log('Q9 rename result', show(await listMine(occ1)).filter((r) => r.who === 'r'))

  const c = await register('Q9 cancel: register', 'c', { occ: occ1 })
  const cancel = await zoom('PUT', `/registrants/status?occurrence_id=${occ1}`, {
    action: 'cancel',
    registrants: [{ id: c?.registrant_id, email: email('c') }],
  })
  log('Q9 cancel', { status: cancel.status, message: cancel.body?.message })
  log('Q9 listed after cancel', show(await listMine(occ1)).filter((r) => r.who === 'c'))
  await register('Q9 register after cancel', 'c', { occ: occ1 })

  const d = await register('Q9 delete: register', 'd', { occ: occ1 })
  const del = await zoom('DELETE', `/registrants/${d?.registrant_id}?occurrence_id=${occ1}`)
  log('Q9 delete', { status: del.status, message: del.body?.message })
  log('Q9 listed after delete', show(await listMine(occ1)).filter((r) => r.who === 'd'))
  await register('Q9 register after delete', 'd', { occ: occ1 })

  for (const occ of [occ1, occ2, occ3, occ4]) await register(`Q10 one call per session, ${occ}`, 'multi', { occ })
  for (let i = 1; i <= 5; i++) await register(`Q10 call ${i}`, 'limit', { occ: occ1 })

  // Opening the page is not joining. Only the host and first path segment are printed.
  const url = links['Q2 B session 1']
  if (url) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000) })
    const to = res.headers.get('location')
    const target = to ? new URL(to, url) : null
    log('Q3 link opened signed out', {
      status: res.status,
      redirect: target && `${target.hostname}/${target.pathname.split('/')[1]}`,
    })
  }
} finally {
  // Delete BEFORE restoring: a registration_type change can wipe registrations
  // by itself, which would make an empty list look like a successful cleanup.
  try {
    await cleanup()
  } finally {
    await setSettings('restored settings', original)
  }
}
