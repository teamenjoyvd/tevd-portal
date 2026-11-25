/**
 * Zoom and Resend for browser tests. Behaviour recorded in ADR-017: the same
 * email and session gives the same registrant, the fourth create in a day is
 * refused, and deleting a missing registrant answers 400 / 3000.
 */
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { FAKE_PORT, FAKE_URL } from './config.mjs'

/** @type {Map<string, { id: string, session: string, email: string, name: string, status: string, link: string }>} */
const registrants = new Map()
const creates = new Map()
const emails = []
const requests = []
/** One entry per armed failure, matched by session so parallel specs do not meet. */
let failures = []

async function readJson(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', FAKE_URL)
  const path = url.pathname
  const body = await readJson(req)
  const send = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(data === undefined ? undefined : JSON.stringify(data))
  }

  if (path === '/health') return send(200, { ok: true })
  if (path === '/state') return send(200, { registrants: [...registrants.values()], emails, requests })
  if (path === '/fail') {
    failures.push({ session: body.session, method: body.method, status: body.status, left: body.times ?? 1 })
    return send(200, {})
  }
  if (path === '/forget') {
    const { session, emailPart } = body
    for (const [id, r] of registrants) if (r.session === session) registrants.delete(id)
    for (const key of creates.keys()) if (key.startsWith(`${session} `)) creates.delete(key)
    failures = failures.filter((f) => f.session !== session)
    if (emailPart) emails.splice(0, emails.length, ...emails.filter((e) => !String(e.to).includes(emailPart)))
    return send(200, {})
  }
  if (path.startsWith('/join/')) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    return res.end('<!doctype html><title>Fake Zoom</title><h1>Fake Zoom</h1>')
  }

  requests.push({ method: req.method, path })
  if (path === '/emails' && req.method === 'POST') {
    const id = randomUUID()
    emails.push({ id, to: body.to, subject: body.subject, html: body.html })
    return send(200, { id })
  }
  if (path === '/zoom/oauth/token') return send(200, { access_token: 'e2e', expires_in: 3600 })

  const match = /^\/zoom\/v2\/webinars\/\d+(\/registrants(?:\/([^/]+))?)?$/.exec(path)
  if (match === null) return send(404, { code: 404, message: 'Not faked' })
  const session = url.searchParams.get('occurrence_ids') ?? url.searchParams.get('occurrence_id')
  const failure = failures.find((f) => f.session === session && f.method === req.method && f.left > 0)
  if (failure !== undefined) {
    failure.left--
    return send(failure.status, { code: failure.status, message: 'Injected failure' })
  }
  const [, isRegistrants, id] = match
  if (!isRegistrants && req.method === 'GET') {
    return send(200, { topic: 'TEST - e2e', type: 9, settings: { registration_type: 2, approval_type: 1 }, occurrences: [] })
  }
  if (req.method === 'POST' && id === undefined) {
    const key = `${session} ${String(body.email).toLowerCase()}`
    const count = (creates.get(key) ?? 0) + 1
    creates.set(key, count)
    if (count > 3) return send(429, { code: 429, message: 'You have exceeded the daily rate limit (3)' })
    const name = `${body.first_name} ${body.last_name}`
    const email = String(body.email).toLowerCase()
    const known = [...registrants.values()].find((r) => r.session === session && r.email === email)
    const row = known ?? { id: randomUUID(), session, email, name, status: 'pending', link: '' }
    row.name = name
    row.link ||= `${FAKE_URL}/join/${row.id}`
    registrants.set(row.id, row)
    return send(201, { registrant_id: row.id, join_url: row.link })
  }
  if (req.method === 'PUT' && id === 'status') {
    for (const r of body.registrants ?? []) {
      const row = registrants.get(r.id)
      if (row !== undefined) row.status = 'approved'
    }
    return send(204)
  }
  if (req.method === 'DELETE' && id !== undefined) {
    if (registrants.get(id)?.session !== session) return send(400, { code: 3000, message: `Registrant ${id} was not found.` })
    registrants.delete(id)
    return send(204)
  }
  return send(404, { code: 404, message: 'Not faked' })
}).listen(FAKE_PORT, '127.0.0.1')
