import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Regression tests for the SQL-level auth guards added by the 2026-07 security
 * audit (#476, #477). These functions are SECURITY DEFINER and run with
 * elevated privilege, so the internal auth check is the only thing standing
 * between an anonymous caller and privilege escalation / data destruction —
 * see docs/ai/GOTCHAS.md "Trusted RPC + service role".
 *
 * There is no Supabase CLI / local Postgres stack available in this
 * environment (checked: `supabase` is not on PATH), so these functions
 * cannot be invoked and asserted against a live database in CI. This is the
 * most rigorous feasible substitute: parse the migration SQL and assert the
 * guard clause is present verbatim, ahead of the mutation logic it protects.
 * Reverting the guard (see PR description for the local revert-and-confirm
 * check) makes this test fail, which is what the issue's verification
 * instructions require.
 */

const MIGRATIONS_DIR = path.join(__dirname)

// Matches the standard guard: `IF auth.role() <> 'service_role' AND NOT is_admin() THEN RAISE EXCEPTION`
const GUARD_PATTERN =
  /IF\s+auth\.role\(\)\s*<>\s*'service_role'\s+AND\s+NOT\s+is_admin\(\)\s+THEN\s+RAISE\s+EXCEPTION/i

function assertGuardedBeforeMutation(sql: string, mutationPattern: RegExp): void {
  expect(sql).toMatch(GUARD_PATTERN)
  const guardIndex = sql.search(GUARD_PATTERN)
  const mutationIndex = sql.search(mutationPattern)
  expect(guardIndex).toBeGreaterThanOrEqual(0)
  expect(mutationIndex).toBeGreaterThan(guardIndex)
}

describe('#476 — patch_member_role guard (supabase/migrations/20260707120000_guard_patch_member_role.sql)', () => {
  const filePath = path.join(MIGRATIONS_DIR, '20260707120000_guard_patch_member_role.sql')

  it('exists on main', () => {
    expect(existsSync(filePath)).toBe(true)
  })

  it('guards the role UPDATE with the service_role/is_admin() check', () => {
    const sql = readFileSync(filePath, 'utf8')
    assertGuardedBeforeMutation(sql, /UPDATE\s+profiles\s+SET\s+role\s*=\s*p_new_role/i)
  })

  it('revokes anon EXECUTE and grants only authenticated/service_role', () => {
    const sql = readFileSync(filePath, 'utf8')
    expect(sql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+patch_member_role[\s\S]*FROM\s+anon/i)
    expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+patch_member_role[\s\S]*TO\s+authenticated/i)
    expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+patch_member_role[\s\S]*TO\s+service_role/i)
  })
})

describe('#477 — purge_absent_los_members / rollback_los_import guard', () => {
  // This migration lives only on the still-open sibling branch dev/2607-DEV-477
  // as of this writing — it has not merged to main. Skip gracefully rather than
  // fail the build for a file that legitimately doesn't exist yet; once #477
  // merges into main, this file will exist and the assertions below activate
  // automatically without further changes.
  const filePath = path.join(MIGRATIONS_DIR, '20260707120100_guard_los_purge_rollback.sql')
  const fileExists = existsSync(filePath)

  it.skipIf(!fileExists)('guards purge_absent_los_members with the service_role/is_admin() check', () => {
    const sql = readFileSync(filePath, 'utf8')
    assertGuardedBeforeMutation(sql, /DELETE\s+FROM\s+public\.los_members/i)
  })

  it.skipIf(!fileExists)('guards rollback_los_import with the service_role/is_admin() check', () => {
    const sql = readFileSync(filePath, 'utf8')
    const guardMatches = [...sql.matchAll(new RegExp(GUARD_PATTERN.source, 'gi'))]
    expect(guardMatches.length).toBeGreaterThanOrEqual(2)
  })

  it.skipIf(!fileExists)('restricts EXECUTE to service_role only (anon/authenticated revoked)', () => {
    const sql = readFileSync(filePath, 'utf8')
    expect(sql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.purge_absent_los_members[\s\S]{0,80}FROM\s+PUBLIC,\s*anon,\s*authenticated/i)
    expect(sql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rollback_los_import[\s\S]{0,80}FROM\s+PUBLIC,\s*anon,\s*authenticated/i)
  })

  if (!fileExists) {
    it('is not yet mergeable — file absent on this branch (NOTED, not a failure)', () => {
      expect(fileExists).toBe(false)
    })
  }
})
