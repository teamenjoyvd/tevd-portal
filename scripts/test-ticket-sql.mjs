#!/usr/bin/env node
/**
 * Ticketing SQL tests (2611-DEV-775) against a LOCAL Postgres with every
 * migration applied. No mocks: rules run in one rolled-back transaction, races
 * run on two real connections.
 *
 *   npm run test:sql                                   local Supabase stack
 *   TICKET_TEST_CONTAINER=name npm run test:sql        psql inside a container
 *
 * TICKET_TEST_DB_URL may point elsewhere, but only at a loopback host. The race
 * tests must commit, and delete what they created.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'

const container = process.env.TICKET_TEST_CONTAINER
const url = process.env.TICKET_TEST_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
  console.error('test-ticket-sql: refusing a non-local database.')
  process.exit(1)
}
const flags = ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-At']
const [cmd, args] = container
  ? ['docker', ['exec', '-i', container, 'psql', '-U', 'postgres', ...flags]]
  : ['psql', [url, ...flags]]

function psql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args)
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }))
    child.stdin.end(sql)
  })
}
async function must(sql) {
  const r = await psql(sql)
  if (r.code !== 0) throw new Error(r.err)
  return r.out
}

let failed = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok' : 'FAIL'} ${label}${ok ? '' : ` ${detail}`}`)
  if (!ok) failed++
}

const rules = await psql(`BEGIN;\n${readFileSync(new URL('../supabase/tests/ticketing.sql', import.meta.url), 'utf8')}\nROLLBACK;`)
const passed = (rules.err.match(/NOTICE: {2}ok /g) ?? []).length
check(`SQL rules (${passed} checks)`, rules.code === 0 && passed > 0, rules.err.split('\n').filter((l) => !l.includes('NOTICE')).join('\n'))

const CLAIM = `SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);`
/** Session A holds its locks for a second; B starts meanwhile and must wait. */
async function race(a, b) {
  const first = psql(`${CLAIM} BEGIN; ${a}; SELECT pg_sleep(1); COMMIT;`)
  await new Promise((r) => setTimeout(r, 400))
  const t = Date.now()
  const second = await psql(`${CLAIM} ${b};`)
  return { first: await first, second, waited: Date.now() - t }
}
const uuid = () => crypto.randomUUID()
const product = `(SELECT id FROM ticket_products WHERE series_key = 'tuesday' AND kind = 'single')`
const ev = uuid()
const passes = [uuid(), uuid(), uuid(), uuid()]
const order = uuid()
const redeem = (pass, event) =>
  `SELECT count(*) FROM redeem_pass_entries('${pass}', '${event}', '[{"name":"Race"}]', 'in_person', 'qr', NULL)`
const evOpen = uuid()
const evOpen2 = uuid()

try {
  await must(`
    INSERT INTO calendar_events (id, title, start_time, end_time, week_number, source, series_key, in_person_capacity) VALUES
      ('${ev}', 'ticket race', now() - interval '1 hour', now() + interval '1 hour', 1, 'zoom', 'tuesday', 1),
      ('${evOpen}', 'ticket race', now() - interval '1 hour', now() + interval '1 hour', 1, 'zoom', 'tuesday', NULL),
      ('${evOpen2}', 'ticket race', now() - interval '1 hour', now() + interval '1 hour', 1, 'zoom', 'tuesday', NULL);
    INSERT INTO ticket_passes (id, product_id, holder_name, holder_email, entries_total, expires_at, unlock_code, qr_token)
      SELECT p, ${product}, 'Race', 'race@example.com', 1, now() + interval '1 day', p::text, p::text
      FROM unnest(ARRAY['${passes.join("','")}']::uuid[]) p;
    INSERT INTO ticket_orders (id, buyer_name, buyer_email, product_id, total_cents, stripe_checkout_session_id)
      VALUES ('${order}', 'Race', 'race@example.com', ${product}, 500, '${order}');`)

  const seat = await race(redeem(passes[0], ev), redeem(passes[1], ev))
  const seats = await must(`SELECT count(*) FROM ticket_admissions WHERE event_id = '${ev}'`)
  check('two passes, last seat: one admitted', seat.first.code === 0 && seat.second.err.includes('event is full') && seats === '1', JSON.stringify(seat))
  check('the second really waited on a lock', seat.waited > 300, `${seat.waited} ms`)

  const entry = await race(redeem(passes[2], evOpen), redeem(passes[2], evOpen))
  check('one pass, last entry: one admitted', entry.first.code === 0 && entry.second.err.includes('not enough entries'), JSON.stringify(entry))

  // Different events, so only the pass lock can stop this one.
  const spread = await race(redeem(passes[3], evOpen), redeem(passes[3], evOpen2))
  check('one pass, last entry, two events: one admitted', spread.first.code === 0 && spread.second.err.includes('not enough entries'), JSON.stringify(spread))

  const f = (code) => `SELECT fulfill_ticket_order('${order}', '${order}', '${code}', '${code}')->>'just_fulfilled'`
  const fulfil = await race(f(uuid()), f(uuid()))
  const made = await must(`SELECT count(*) FROM ticket_passes WHERE order_id = '${order}'`)
  check('two fulfilments: one just_fulfilled, one pass', /\btrue\b/.test(fulfil.first.out) && /\bfalse\b/.test(fulfil.second.out) && made === '1', JSON.stringify(fulfil))
} finally {
  await must(`
    DELETE FROM ticket_admissions WHERE event_id IN ('${ev}', '${evOpen}', '${evOpen2}');
    DELETE FROM ticket_passes WHERE id IN ('${passes.join("','")}') OR order_id = '${order}';
    DELETE FROM ticket_orders WHERE id = '${order}';
    DELETE FROM calendar_events WHERE id IN ('${ev}', '${evOpen}', '${evOpen2}');`)
}
process.exit(failed ? 1 : 0)
