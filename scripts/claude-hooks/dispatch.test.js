import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Tests for the Claude Code hook dispatcher (issue #572). The dispatcher is
 * exercised the way the harness runs it: spawn `node dispatch.js` with the
 * hook payload on stdin and assert on the exit code / stderr. Exit 2 = block,
 * exit 0 = allow (a PostToolUse warning goes to stdout JSON, still exit 0).
 */

const DISPATCH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dispatch.js')

function run(payload) {
  try {
    const stdout = execFileSync(process.execPath, [DISPATCH], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      windowsHide: true,
    })
    return { code: 0, stdout, stderr: '' }
  } catch (err) {
    return { code: err.status, stdout: err.stdout ?? '', stderr: err.stderr ?? '' }
  }
}

function pre(tool, tool_input) {
  return { hook_event_name: 'PreToolUse', tool_name: tool, tool_input }
}
function post(tool, tool_input) {
  return { hook_event_name: 'PostToolUse', tool_name: tool, tool_input }
}

describe('hard-constraint blocks (exit 2)', () => {
  it('blocks creating middleware.ts', () => {
    const r = run(pre('Write', { file_path: 'D:\\repo\\middleware.ts', content: 'export {}' }))
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('proxy.ts')
  })

  it('blocks service-role key in a use-client file', () => {
    const r = run(pre('Edit', {
      file_path: 'app/foo/page.tsx',
      new_string: '"use client"\nconst k = process.env.SUPABASE_SERVICE_ROLE_KEY',
    }))
    expect(r.code).toBe(2)
  })

  it('blocks service-role key assigned to NEXT_PUBLIC_*', () => {
    const r = run(pre('Write', {
      file_path: '.env.example',
      content: 'NEXT_PUBLIC_KEY=${SUPABASE_SERVICE_ROLE_KEY}',
    }))
    expect(r.code).toBe(2)
  })

  it('blocks git push to main', () => {
    for (const cmd of ['git push origin main', 'git push -f origin HEAD:main']) {
      expect(run(pre('Bash', { command: cmd })).code).toBe(2)
    }
  })

  it('blocks bad branch names at creation', () => {
    const r = run(pre('Bash', { command: 'git checkout -b feature/foo' }))
    expect(r.code).toBe(2)
  })

  it('blocks badly named new migration files', () => {
    // wall-clock HHMMSS and the old truncating YYYYMMDD_NNN form both blocked
    for (const bad of ['20260716123456_thing.sql', '20260716_001_thing.sql']) {
      const r = run(pre('Write', {
        file_path: `supabase/migrations/${bad}`,
        content: 'select 1;',
      }))
      expect(r.code).toBe(2)
      expect(r.stderr).toContain('YYYYMMDD00NN00')
    }
  })

  it('blocks MCP push_files to main and bad MCP branch names', () => {
    expect(run(pre('mcp__github-tevd__push_files', {
      branch: 'main',
      files: [{ path: 'a.txt', content: 'x' }],
    })).code).toBe(2)
    expect(run(pre('mcp__github-tevd__create_branch', { branch: 'feature/x' })).code).toBe(2)
  })
})

describe('legitimate operations pass (exit 0)', () => {
  it('allows normal edits, pushes, and branch names', () => {
    const allowed = [
      pre('Write', { file_path: 'app/proxy-helper.ts', content: 'export const a = 1' }),
      pre('Write', { file_path: 'supabase/migrations/20260716000100_add_thing.sql', content: '-- ROLLBACK: drop\nselect 1;' }),
      pre('Bash', { command: 'git push origin dev/2607-DEV-572' }),
      pre('Bash', { command: 'git checkout -b dev/2607-DEV-572-hooks' }),
      pre('Bash', { command: 'git checkout -b claude/some-slug-1a2b' }),
      pre('Bash', { command: 'git checkout main' }),
      // Text inside quotes/heredocs that merely MENTIONS forbidden commands
      pre('Bash', { command: 'gh pr create --title "t" --body "$(cat <<\'EOF\'\nBlocks `git push` to main and prod db push (ynykjpnetfwqzdnsgkkg).\nEOF\n)"' }),
      pre('Bash', { command: 'git commit -m "docs: never git push origin main"' }),
      pre('mcp__github-tevd__create_branch', { branch: 'dev/2607-DEV-design-sync' }),
    ]
    for (const p of allowed) {
      expect(run(p).code).toBe(0)
    }
  })

  it('server-side service-role usage is not blocked', () => {
    const r = run(pre('Write', {
      file_path: 'lib/supabase/server.ts',
      content: 'const key = process.env.SUPABASE_SERVICE_ROLE_KEY',
    }))
    expect(r.code).toBe(0)
  })
})

describe('non-blocking warnings (exit 0 + context)', () => {
  it('warns on migration without ROLLBACK comment', () => {
    const r = run(post('Write', {
      file_path: 'supabase/migrations/20260716000100_add_thing.sql',
      content: 'create table x(id int);',
    }))
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('ROLLBACK')
  })

  it('warns on commands touching the prod ref or db push', () => {
    const r = run(post('Bash', { command: 'supabase db push --linked' }))
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('migrate-prod')
  })
})

describe('fail-open', () => {
  it('exits 0 on garbage stdin', () => {
    expect(run('not json at all').code).toBe(0)
  })
})
