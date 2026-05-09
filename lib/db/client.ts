import postgres from 'postgres'

/**
 * Direct postgres.js client for use inside Inngest job steps.
 *
 * Uses the DATABASE_URL direct connection (port 5432, NOT the pooler at 6543).
 * Inngest steps use explicit BEGIN/COMMIT/ROLLBACK — pooler mode is incompatible
 * with explicit transactions.
 *
 * max: 1 — Inngest functions run in isolated serverless invocations.
 * idle_timeout + connect_timeout — prevent hung connections from blocking retries.
 */
const sql = postgres(process.env.DATABASE_URL!, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
})

export default sql
